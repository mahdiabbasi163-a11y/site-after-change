import { getDbPool, isMySqlOffline, parseJsonColumn, setMySqlOffline } from "../db/db";

const memorySettingsStore: Record<string, any> = {
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  smsSettings: { apiKey: "", lineNumber: "", provider: "ghasedak" },
  citiesList: [],
  brandsList: [],
  categoriesList: [],
  modelsList: [],
  commonProblems: [],
  adminAnnouncement: "",
  trustBadges: [],
  supportPhone: ""
};

export const SettingsRepository = {
  async getSettings(): Promise<any> {
    if (isMySqlOffline) return { ...memorySettingsStore };
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM settings");
      const result: any = { ...memorySettingsStore };

      if (Array.isArray(rows)) {
        for (const row of rows as any[]) {
          result[row.setting_key] = parseJsonColumn(row.setting_value);
        }
      }

      return result;
    } catch (err: any) {
      setMySqlOffline(true);
      return { ...memorySettingsStore };
    }
  },
  async getSetting(key: string): Promise<any> {
    if (isMySqlOffline) {
      return memorySettingsStore[key] ?? null;
    }
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = ?", [key]);
      const arr = rows as any[];
      if (arr.length === 0) return memorySettingsStore[key] ?? null;
      return parseJsonColumn(arr[0].setting_value);
    } catch (err: any) {
      setMySqlOffline(true);
      return memorySettingsStore[key] ?? null;
    }
  },
  async setSetting(key: string, value: any): Promise<void> {
    const pool = getDbPool();
    const valStr = typeof value === "object" ? JSON.stringify(value) : String(value);
    await pool.query(
      `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, valStr]
    );
    memorySettingsStore[key] = value;
  },
  async updateSettings(updates: Record<string, any>): Promise<any> {
    for (const [k, v] of Object.entries(updates)) {
      await SettingsRepository.setSetting(k, v);
    }
    return SettingsRepository.getSettings();
  }
};
