import { getDbPool, toSqlDatetime } from "../db/db";

export const SubscriptionRepository = {
  async findAll(): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM subscriptions ORDER BY created_at DESC");
    return rows as any[];
  },
  async findById(id: string): Promise<any | null> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM subscriptions WHERE id = ?", [id]);
    const arr = rows as any[];
    return arr.length > 0 ? arr[0] : null;
  },
  async findByUserId(userId: string): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return rows as any[];
  },
  async create(subData: any): Promise<any> {
    const pool = getDbPool();
    const id = subData.id || `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const userId = subData.user_id || subData.userId;
    const planType = subData.plan_type || subData.planType || "bronze";
    const startDate = toSqlDatetime(subData.start_date || subData.startDate || new Date());
    const endDate = toSqlDatetime(subData.end_date || subData.endDate);
    const status = subData.status || "active";

    await pool.query(
      `INSERT INTO subscriptions (id, user_id, plan_type, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, planType, startDate, endDate, status]
    );

    return SubscriptionRepository.findById(id);
  },
  async update(id: string, updates: any): Promise<any | null> {
    const pool = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.plan_type !== undefined || updates.planType !== undefined) {
      fields.push("plan_type = ?");
      values.push(updates.plan_type ?? updates.planType);
    }
    if (updates.end_date !== undefined || updates.endDate !== undefined) {
      fields.push("end_date = ?");
      values.push(toSqlDatetime(updates.end_date ?? updates.endDate));
    }
    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }

    if (fields.length === 0) return SubscriptionRepository.findById(id);

    values.push(id);
    await pool.query(`UPDATE subscriptions SET ${fields.join(", ")} WHERE id = ?`, values);
    return SubscriptionRepository.findById(id);
  },
  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM subscriptions WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};
