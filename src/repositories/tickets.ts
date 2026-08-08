import { getDbPool } from "../db/db";
import { TicketMessageRepository } from "./ticket_messages";

export const TicketRepository = {
  async findAll(): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM tickets ORDER BY updated_at DESC");
    const tickets = rows as any[];
    for (const t of tickets) {
      t.messages = await TicketMessageRepository.findByTicketId(t.id);
    }
    return tickets;
  },
  async findById(id: string): Promise<any | null> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM tickets WHERE id = ?", [id]);
    const arr = rows as any[];
    if (arr.length === 0) return null;
    const ticket = arr[0];
    ticket.messages = await TicketMessageRepository.findByTicketId(ticket.id);
    return ticket;
  },
  async findByUserId(userId: string): Promise<any[]> {
    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM tickets WHERE user_id = ? ORDER BY updated_at DESC", [userId]);
    const tickets = rows as any[];
    for (const t of tickets) {
      t.messages = await TicketMessageRepository.findByTicketId(t.id);
    }
    return tickets;
  },
  async create(ticketData: any): Promise<any> {
    const pool = getDbPool();
    const id = ticketData.id || `ticket_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const userId = ticketData.user_id || ticketData.userId;
    const subject = ticketData.subject || "";
    const status = ticketData.status || "open";
    const priority = ticketData.priority || "normal";

    await pool.query(
      `INSERT INTO tickets (id, user_id, subject, status, priority)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, subject, status, priority]
    );

    if (ticketData.initialMessage || ticketData.message) {
      const msg = ticketData.initialMessage || ticketData.message;
      await TicketMessageRepository.create(id, {
        sender_type: "user",
        sender_id: userId,
        message: msg
      });
    }

    return TicketRepository.findById(id);
  },
  async update(id: string, updates: any): Promise<any | null> {
    const pool = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
    if (updates.priority !== undefined) { fields.push("priority = ?"); values.push(updates.priority); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE tickets SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    return TicketRepository.findById(id);
  },
  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM tickets WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};
