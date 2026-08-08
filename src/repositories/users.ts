import { getDbPool, isMySqlOffline, setMySqlOffline } from "../db/db";
import { normalizePhone } from "../utils/phone";

const memoryUsers: any[] = [
  {
    id: "admin",
    phone: "09120947304",
    full_name: "مدیریت عالی کدیار۲۴",
    role: "admin",
    is_super_admin: true,
    wallet_balance: 0,
    created_at: new Date().toISOString()
  }
];

export const UserRepository = {
  async findAll(): Promise<any[]> {
    if (isMySqlOffline) return [...memoryUsers];
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
      return rows as any[];
    } catch (err: any) {
      setMySqlOffline(true);
      return [...memoryUsers];
    }
  },
  async findById(id: string): Promise<any | null> {
    if (isMySqlOffline) {
      return memoryUsers.find(u => String(u.id) === String(id)) || null;
    }
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
      const arr = rows as any[];
      return arr.length > 0 ? arr[0] : null;
    } catch (err: any) {
      setMySqlOffline(true);
      return memoryUsers.find(u => String(u.id) === String(id)) || null;
    }
  },
  async findByPhone(phoneInput: string): Promise<any | null> {
    if (!phoneInput) return null;
    const normalized = normalizePhone(phoneInput);
    if (isMySqlOffline) {
      return memoryUsers.find(u => normalizePhone(u.phone) === normalized || u.phone === phoneInput) || null;
    }
    try {
      const pool = getDbPool();
      const raw = String(phoneInput).trim();
      const withoutZero = normalized.startsWith("0") ? normalized.substring(1) : normalized;
      const withPlus98 = normalized.startsWith("0") ? `+98${normalized.substring(1)}` : `+98${normalized}`;
      const with98 = normalized.startsWith("0") ? `98${normalized.substring(1)}` : `98${normalized}`;

      const [rows] = await pool.query(
        "SELECT * FROM users WHERE phone = ? OR phone = ? OR phone = ? OR phone = ? OR phone = ? LIMIT 1",
        [normalized, raw, withoutZero, withPlus98, with98]
      );
      const arr = rows as any[];
      return arr.length > 0 ? arr[0] : null;
    } catch (err: any) {
      setMySqlOffline(true);
      return memoryUsers.find(u => normalizePhone(u.phone) === normalized || u.phone === phoneInput) || null;
    }
  },
  async create(userData: any): Promise<any> {
    const id = userData.id || `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const phone = userData.phone;
    const fullName = userData.full_name || userData.fullName || userData.name || "";
    const role = userData.role || "client";
    const passwordHash = userData.password_hash || userData.passwordHash || userData.password || "";
    const walletBalance = userData.wallet_balance || userData.walletBalance || 0;
    const city = userData.city || "تهران";

    const pool = getDbPool();
    await pool.query(
      `INSERT INTO users (id, phone, full_name, role, password_hash, wallet_balance, city) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, phone, fullName, role, passwordHash, walletBalance, city]
    );
    return UserRepository.findById(id);
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
    if (updates.role !== undefined) { fields.push("role = ?"); values.push(updates.role); }
    if (updates.password_hash !== undefined || updates.password !== undefined) {
      fields.push("password_hash = ?");
      values.push(updates.password_hash ?? updates.password);
    }
    if (updates.wallet_balance !== undefined || updates.walletBalance !== undefined) {
      fields.push("wallet_balance = ?");
      values.push(updates.wallet_balance ?? updates.walletBalance);
    }
    if (updates.city !== undefined) { fields.push("city = ?"); values.push(updates.city); }

    if (fields.length === 0) return UserRepository.findById(id);

    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    return UserRepository.findById(id);
  },
  async addWalletBalanceTransaction(userId: string, amount: number, description: string): Promise<number> {
    const pool = getDbPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, userId]);

      const txId = `wtx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await connection.query(
        "INSERT INTO wallet_transactions (id, user_id, type, amount, description) VALUES (?, ?, 'deposit', ?, ?)",
        [txId, userId, amount, description]
      );

      const [rows]: any = await connection.query("SELECT wallet_balance FROM users WHERE id = ?", [userId]);
      await connection.commit();
      return rows[0]?.wallet_balance || 0;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },
  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM users WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};
