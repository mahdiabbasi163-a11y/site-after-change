import { getDbPool } from "../db/db";

export const TicketMessageRepository = {
  async findByTicketId(ticketId: string): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC", [ticketId]);
    return rows as any[];
  },
  async create(ticketId: string, msgData: any): Promise<any> {
    const pool = getDbPool();
    const id = msgData.id || `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const senderType = msgData.sender_type || msgData.senderType || "user";
    const senderId = msgData.sender_id || msgData.senderId || null;
    const message = msgData.message || "";

    await pool.query(
      `INSERT INTO ticket_messages (id, ticket_id, sender_type, sender_id, message)
       VALUES (?, ?, ?, ?, ?)`,
      [id, ticketId, senderType, senderId, message]
    );

    await pool.query("UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [ticketId]);

    const [rows] = await pool.query("SELECT * FROM ticket_messages WHERE id = ?", [id]);
    const arr = rows as any[];
    return arr.length > 0 ? arr[0] : null;
  }
};
