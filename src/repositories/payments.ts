import { getDbPool } from "../db/db";

export const PaymentRepository = {
  async findAll(): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM payments ORDER BY created_at DESC");
    return rows as any[];
  },
  async findById(id: string): Promise<any | null> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM payments WHERE id = ?", [id]);
    const arr = rows as any[];
    return arr.length > 0 ? arr[0] : null;
  },
  async findByAuthority(authority: string): Promise<any | null> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM payments WHERE authority = ?", [authority]);
    const arr = rows as any[];
    return arr.length > 0 ? arr[0] : null;
  },
  async findByUserId(userId: string): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return rows as any[];
  },
  async create(payData: any): Promise<any> {
    const pool = getDbPool();
    const id = payData.id || `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const userId = payData.user_id || payData.userId || null;
    const orderId = payData.order_id || payData.orderId || null;
    const relatedType = payData.related_type || payData.relatedType || null;
    const relatedId = payData.related_id || payData.relatedId || null;
    const amount = payData.amount || 0;
    const authority = payData.authority || `AUTH_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const refId = payData.ref_id || payData.refId || null;
    const status = payData.status || "pending";
    const paymentMethod = payData.payment_method || payData.paymentMethod || "online";

    await pool.query(
      `INSERT INTO payments (id, user_id, order_id, related_type, related_id, amount, authority, ref_id, status, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, orderId, relatedType, relatedId, amount, authority, refId, status, paymentMethod]
    );

    return PaymentRepository.findById(id);
  },
  async update(id: string, updates: any): Promise<any | null> {
    const pool = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
    if (updates.ref_id !== undefined || updates.refId !== undefined) {
      fields.push("ref_id = ?");
      values.push(updates.ref_id ?? updates.refId);
    }
    if (updates.amount !== undefined) { fields.push("amount = ?"); values.push(updates.amount); }

    if (fields.length === 0) return PaymentRepository.findById(id);

    values.push(id);
    await pool.query(`UPDATE payments SET ${fields.join(", ")} WHERE id = ?`, values);
    return PaymentRepository.findById(id);
  },
  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM payments WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};
