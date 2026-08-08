import { getDbPool, isMySqlOffline, setMySqlOffline } from "../db/db";
import { normalizePhone } from "../utils/phone";

const memoryTechnicians: any[] = [];

export const TechnicianRepository = {
  async findAll(): Promise<any[]> {
    if (isMySqlOffline) return [...memoryTechnicians];
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM technicians ORDER BY created_at DESC");
      return rows as any[];
    } catch (err: any) {
      setMySqlOffline(true);
      return [...memoryTechnicians];
    }
  },
  async findById(id: string): Promise<any | null> {
    if (isMySqlOffline) {
      return memoryTechnicians.find(t => String(t.id) === String(id)) || null;
    }
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM technicians WHERE id = ?", [id]);
      const arr = rows as any[];
      return arr.length > 0 ? arr[0] : null;
    } catch (err: any) {
      setMySqlOffline(true);
      return memoryTechnicians.find(t => String(t.id) === String(id)) || null;
    }
  },
  async findByPhone(phoneInput: string): Promise<any | null> {
    if (!phoneInput) return null;
    const normalized = normalizePhone(phoneInput);
    if (isMySqlOffline) {
      return memoryTechnicians.find(t => normalizePhone(t.phone) === normalized || t.phone === phoneInput) || null;
    }
    try {
      const pool = getDbPool();
      const raw = String(phoneInput).trim();
      const withoutZero = normalized.startsWith("0") ? normalized.substring(1) : normalized;
      const withPlus98 = normalized.startsWith("0") ? `+98${normalized.substring(1)}` : `+98${normalized}`;
      const with98 = normalized.startsWith("0") ? `98${normalized.substring(1)}` : `98${normalized}`;

      const [rows] = await pool.query(
        "SELECT * FROM technicians WHERE phone = ? OR phone = ? OR phone = ? OR phone = ? OR phone = ? LIMIT 1",
        [normalized, raw, withoutZero, withPlus98, with98]
      );
      const arr = rows as any[];
      return arr.length > 0 ? arr[0] : null;
    } catch (err: any) {
      setMySqlOffline(true);
      return memoryTechnicians.find(t => normalizePhone(t.phone) === normalized || t.phone === phoneInput) || null;
    }
  },
  async create(techData: any): Promise<any> {
    const id = techData.id || `tech_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const phone = techData.phone;
    const fullName = techData.full_name || techData.fullName || techData.name || "";
    const nationalId = techData.national_id || techData.nationalId || "";
    const city = techData.city || techData.activeLocation || "تهران";
    const specialties = typeof techData.specialties === "object" ? JSON.stringify(techData.specialties) : (techData.specialties || techData.specialty || "[]");
    const avatarUrl = techData.avatar_url || techData.avatarUrl || "";
    const status = techData.status || "active";
    const walletBalance = techData.wallet_balance || techData.balance || 0;

    const pool = getDbPool();
    await pool.query(
      `INSERT INTO technicians (id, phone, name, full_name, national_id, city, specialty, specialties, avatar_url, status, wallet_balance) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, phone, fullName, fullName, nationalId, city, specialties, specialties, avatarUrl, status, walletBalance]
    );

    return TechnicianRepository.findById(id);
  },
  async update(id: string, updates: any): Promise<any | null> {
    const pool = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.phone !== undefined) { fields.push("phone = ?"); values.push(updates.phone); }
    if (updates.full_name !== undefined || updates.fullName !== undefined || updates.name !== undefined) {
      fields.push("full_name = ?");
      values.push(updates.full_name ?? updates.fullName ?? updates.name);
    }
    if (updates.national_id !== undefined || updates.nationalId !== undefined) {
      fields.push("national_id = ?");
      values.push(updates.national_id ?? updates.nationalId);
    }
    if (updates.city !== undefined || updates.activeLocation !== undefined) {
      fields.push("city = ?");
      values.push(updates.city ?? updates.activeLocation);
    }
    if (updates.specialties !== undefined || updates.specialty !== undefined) {
      fields.push("specialties = ?");
      const val = updates.specialties ?? updates.specialty;
      values.push(typeof val === "object" ? JSON.stringify(val) : val);
    }
    if (updates.avatar_url !== undefined || updates.avatarUrl !== undefined) {
      fields.push("avatar_url = ?");
      values.push(updates.avatar_url ?? updates.avatarUrl);
    }
    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
    if (updates.wallet_balance !== undefined || updates.balance !== undefined) {
      fields.push("wallet_balance = ?");
      values.push(updates.wallet_balance ?? updates.balance);
    }

    if (fields.length === 0) return TechnicianRepository.findById(id);

    values.push(id);
    await pool.query(`UPDATE technicians SET ${fields.join(", ")} WHERE id = ?`, values);
    return TechnicianRepository.findById(id);
  },
  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM technicians WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};
