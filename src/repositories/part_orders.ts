import { getDbPool } from "../db/db";

export const PartOrderRepository = {
  async findAll(): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM part_orders ORDER BY created_at DESC");
    return rows as any[];
  },
  async findById(id: string): Promise<any | null> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM part_orders WHERE id = ?", [id]);
    const arr = rows as any[];
    return arr.length > 0 ? arr[0] : null;
  },
  async findByUserId(userId: string): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM part_orders WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return rows as any[];
  },
  async create(poData: any): Promise<any> {
    const pool = getDbPool();
    const id = poData.id || `po_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const userId = poData.user_id || poData.userId || null;
    const partId = poData.part_id || poData.partId || null;
    const quantity = poData.quantity || 1;
    const totalPrice = poData.total_price || poData.totalPrice || 0;
    const status = poData.status || "pending";

    await pool.query(
      `INSERT INTO part_orders (id, user_id, part_id, quantity, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, partId, quantity, totalPrice, status]
    );

    return PartOrderRepository.findById(id);
  },

  // Atomic Part Purchase with transaction (Requirement 6)
  async createPartPurchaseTransaction(data: {
    userId: string;
    partId: string;
    quantity: number;
    totalPrice: number;
    paymentMethod?: string;
  }): Promise<{ partOrder: any; payment: any }> {
    const pool = getDbPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Check & decrease stock atomically: stock = stock - ? WHERE id = ? AND stock >= ?
      const [stockResult]: any = await connection.query(
        "UPDATE spare_parts SET stock = stock - ? WHERE id = ? AND stock >= ?",
        [data.quantity, data.partId, data.quantity]
      );

      if (stockResult.affectedRows === 0) {
        throw new Error("موجودی قطعه کافی نیست.");
      }

      // 2. Insert part order
      const poId = `po_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await connection.query(
        `INSERT INTO part_orders (id, user_id, part_id, quantity, total_price, status)
         VALUES (?, ?, ?, ?, ?, 'paid')`,
        [poId, data.userId, data.partId, data.quantity, data.totalPrice]
      );

      // 3. Insert payment record linked with related_type='part_order' & related_id=poId
      const payId = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const authority = `AUTH_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await connection.query(
        `INSERT INTO payments (id, user_id, amount, authority, status, payment_method, related_type, related_id)
         VALUES (?, ?, ?, ?, 'completed', ?, 'part_order', ?)`,
        [payId, data.userId, data.totalPrice, authority, data.paymentMethod || "wallet", poId]
      );

      await connection.commit();

      const [poRows] = await pool.query("SELECT * FROM part_orders WHERE id = ?", [poId]);
      const [payRows] = await pool.query("SELECT * FROM payments WHERE id = ?", [payId]);

      return {
        partOrder: (poRows as any[])[0],
        payment: (payRows as any[])[0]
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // Update status with optional stock adjustment in a transaction
  async updateStatusTransaction(id: string, newStatus: string): Promise<any> {
    const pool = getDbPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query("SELECT * FROM part_orders WHERE id = ?", [id]);
      const arr = rows as any[];
      if (arr.length === 0) throw new Error("سفارش قطعه یافت نشد.");
      const currentPO = arr[0];

      if (currentPO.status !== "cancelled" && newStatus === "cancelled") {
        // Restore stock
        await connection.query(
          "UPDATE spare_parts SET stock = stock + ? WHERE id = ?",
          [currentPO.quantity, currentPO.part_id]
        );
      }

      await connection.query(
        "UPDATE part_orders SET status = ? WHERE id = ?",
        [newStatus, id]
      );

      await connection.commit();
      return PartOrderRepository.findById(id);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async update(id: string, updates: any): Promise<any | null> {
    const pool = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
    if (updates.quantity !== undefined) { fields.push("quantity = ?"); values.push(updates.quantity); }
    if (updates.total_price !== undefined || updates.totalPrice !== undefined) {
      fields.push("total_price = ?");
      values.push(updates.total_price ?? updates.totalPrice);
    }

    if (fields.length === 0) return PartOrderRepository.findById(id);

    values.push(id);
    await pool.query(`UPDATE part_orders SET ${fields.join(", ")} WHERE id = ?`, values);
    return PartOrderRepository.findById(id);
  },
  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM part_orders WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};
