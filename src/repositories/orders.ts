import { getDbPool, isMySqlOffline, setMySqlOffline } from "../db/db";
import { OrderStatusHistoryRepository } from "./order_status_history";

const memoryOrders: any[] = [];

export const OrderRepository = {
  async findAll(): Promise<any[]> {
    if (isMySqlOffline) return [...memoryOrders];
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
      const orders = rows as any[];
      for (const o of orders) {
        o.trackingHistory = await OrderStatusHistoryRepository.findAll(o.id);
      }
      return orders;
    } catch (err: any) {
      setMySqlOffline(true);
      return [...memoryOrders];
    }
  },
  async findById(id: string): Promise<any | null> {
    if (isMySqlOffline) {
      return memoryOrders.find(o => String(o.id) === String(id)) || null;
    }
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM orders WHERE id = ?", [id]);
      const arr = rows as any[];
      if (arr.length === 0) return memoryOrders.find(o => String(o.id) === String(id)) || null;
      const order = arr[0];
      order.trackingHistory = await OrderStatusHistoryRepository.findAll(order.id);
      return order;
    } catch (err: any) {
      setMySqlOffline(true);
      return memoryOrders.find(o => String(o.id) === String(id)) || null;
    }
  },
  async findByUserId(userId: string): Promise<any[]> {
    if (isMySqlOffline) {
      return memoryOrders.filter(o => String(o.user_id || o.userId) === String(userId));
    }
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [userId]);
      const orders = rows as any[];
      for (const o of orders) {
        o.trackingHistory = await OrderStatusHistoryRepository.findAll(o.id);
      }
      return orders;
    } catch (err: any) {
      setMySqlOffline(true);
      return memoryOrders.filter(o => String(o.user_id || o.userId) === String(userId));
    }
  },
  async findByTechnicianId(techId: string): Promise<any[]> {
    if (isMySqlOffline) {
      return memoryOrders.filter(o => String(o.technician_id || o.technicianId) === String(techId));
    }
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM orders WHERE technician_id = ? ORDER BY created_at DESC", [techId]);
      const orders = rows as any[];
      for (const o of orders) {
        o.trackingHistory = await OrderStatusHistoryRepository.findAll(o.id);
      }
      return orders;
    } catch (err: any) {
      setMySqlOffline(true);
      return memoryOrders.filter(o => String(o.technician_id || o.technicianId) === String(techId));
    }
  },
  async create(orderData: any): Promise<any> {
    const id = orderData.id || `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const userId = orderData.user_id || orderData.userId || null;
    const techId = orderData.technician_id || orderData.technicianId || null;
    const category = orderData.category || "";
    const brand = orderData.brand || "";
    const model = orderData.model || "";
    const problemDesc = orderData.problem_description || orderData.problemDescription || orderData.problem || "";
    const customerName = orderData.customer_name || orderData.customerName || "";
    const customerPhone = orderData.customer_phone || orderData.customerPhone || "";
    const address = orderData.address || "";
    const city = orderData.city || "";
    const status = orderData.status || "pending";
    const amount = orderData.amount || 0;
    const report = orderData.report || "";

    const newOrder = {
      id, user_id: userId, technician_id: techId, category, brand, model,
      problem_description: problemDesc, customer_name: customerName, customer_phone: customerPhone,
      address, city, status, amount, report, created_at: new Date().toISOString(), trackingHistory: []
    };

    const pool = getDbPool();
    await pool.query(
      `INSERT INTO orders (id, user_id, technician_id, category, brand, model, problem_description, customer_name, customer_phone, address, city, status, amount, report)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, techId, category, brand, model, problemDesc, customerName, customerPhone, address, city, status, amount, report]
    );

    await OrderStatusHistoryRepository.create(id, {
      status,
      title: `ثبت سفارش جدید`,
      updated_by: customerName || "مشتری"
    });

    return OrderRepository.findById(id);
  },
  async update(id: string, updates: any): Promise<any | null> {
    const pool = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.user_id !== undefined || updates.userId !== undefined) {
      fields.push("user_id = ?");
      values.push(updates.user_id ?? updates.userId);
    }
    if (updates.technician_id !== undefined || updates.technicianId !== undefined) {
      fields.push("technician_id = ?");
      values.push(updates.technician_id ?? updates.technicianId);
    }
    if (updates.category !== undefined) { fields.push("category = ?"); values.push(updates.category); }
    if (updates.brand !== undefined) { fields.push("brand = ?"); values.push(updates.brand); }
    if (updates.model !== undefined) { fields.push("model = ?"); values.push(updates.model); }
    if (updates.problem_description !== undefined || updates.problemDescription !== undefined) {
      fields.push("problem_description = ?");
      values.push(updates.problem_description ?? updates.problemDescription);
    }
    if (updates.customer_name !== undefined || updates.customerName !== undefined) {
      fields.push("customer_name = ?");
      values.push(updates.customer_name ?? updates.customerName);
    }
    if (updates.customer_phone !== undefined || updates.customerPhone !== undefined) {
      fields.push("customer_phone = ?");
      values.push(updates.customer_phone ?? updates.customerPhone);
    }
    if (updates.address !== undefined) { fields.push("address = ?"); values.push(updates.address); }
    if (updates.city !== undefined) { fields.push("city = ?"); values.push(updates.city); }
    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
    if (updates.amount !== undefined) { fields.push("amount = ?"); values.push(updates.amount); }
    if (updates.report !== undefined) { fields.push("report = ?"); values.push(updates.report); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE orders SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    if (updates.historyItem || updates.note || updates.status) {
      await OrderStatusHistoryRepository.create(id, {
        status: updates.status,
        title: updates.note || updates.report || `تغییر وضعیت به ${updates.status}`,
        updated_by: updates.updated_by || updates.updatedBy || "سیستم"
      });
    }

    return OrderRepository.findById(id);
  },
  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM orders WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};
