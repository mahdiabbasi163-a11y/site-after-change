import { getDbPool } from "../db/db";

export const WalletTransactionRepository = {
  async findAll(): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM wallet_transactions ORDER BY created_at DESC");
    return rows as any[];
  },
  async findById(id: string): Promise<any | null> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM wallet_transactions WHERE id = ?", [id]);
    const arr = rows as any[];
    return arr.length > 0 ? arr[0] : null;
  },
  async findByUserId(userId: string): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return rows as any[];
  },
  async create(wtData: any): Promise<any> {
    const pool = getDbPool();
    const id = wtData.id || `wt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const userId = wtData.user_id || wtData.userId;
    const type = wtData.type || "deposit";
    const amount = wtData.amount || 0;
    const description = wtData.description || "";

    await pool.query(
      `INSERT INTO wallet_transactions (id, user_id, type, amount, description)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, type, amount, description]
    );

    return WalletTransactionRepository.findById(id);
  }
};
