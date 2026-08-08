import { Router } from "express";
import { getCurrentUserAsync, logActivity } from "../db/db";
import { TicketRepository, TicketMessageRepository } from "../repositories";

const router = Router();

// POST /api/tickets/create
router.post("/create", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);

    const { subject, message, department, priority } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ status: "error", error: "موضوع و متن پیام الزامی هستند." });
    }

    const ticketId = `tick_${Date.now()}`;
    const userId = user ? user.id : "guest";

    const newTicket = await TicketRepository.create({
      id: ticketId,
      user_id: userId,
      subject: subject,
      status: "open",
      priority: priority || "normal",
      initialMessage: message
    });

    if (user) {
      await logActivity(user.id, "ایجاد تیکت پشتیبانی جدید", req, `موضوع: ${subject}`);
    }

    return res.json({
      status: "ok",
      message: "تیکت شما با موفقیت ثبت شد و به‌زودی کارشناسان پاسخ خواهند داد.",
      ticket_id: ticketId,
      ticket: newTicket
    });
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

// GET /api/tickets/list
router.get("/list", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);

    if (!user) {
      return res.status(401).json({ status: "error", error: "احراز هویت نشده است." });
    }

    if (user.role === "admin") {
      const tickets = await TicketRepository.findAll();
      return res.json({ status: "ok", tickets });
    } else {
      const tickets = await TicketRepository.findByUserId(user.id);
      return res.json({ status: "ok", tickets });
    }
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

// GET /api/tickets/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUserAsync(req);

    const ticket = await TicketRepository.findById(id);
    if (!ticket) {
      return res.status(404).json({ status: "error", error: "تیکت یافت نشد." });
    }

    if (user && user.role !== "admin" && ticket.user_id !== user.id) {
      return res.status(403).json({ status: "error", error: "شما مجاز به مشاهده این تیکت نیستید." });
    }

    return res.json({ status: "ok", ticket });
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

// POST /api/tickets/reply
router.post("/reply", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    const { ticket_id, message } = req.body;

    if (!ticket_id || !message) {
      return res.status(400).json({ status: "error", error: "شناسه تیکت و پاسخ الزامی است." });
    }

    const ticket = await TicketRepository.findById(ticket_id);
    if (!ticket) {
      return res.status(404).json({ status: "error", error: "تیکت یافت نشد." });
    }

    const isSenderAdmin = user && user.role === "admin";
    const senderType = isSenderAdmin ? "admin" : "user";
    const newStatus = isSenderAdmin ? "answered" : "open";

    await TicketMessageRepository.create(ticket_id, {
      sender_type: senderType,
      sender_id: user ? user.id : null,
      message
    });

    await TicketRepository.update(ticket_id, { status: newStatus });
    const updatedTicket = await TicketRepository.findById(ticket_id);

    return res.json({ status: "ok", message: "پاسخ شما با موفقیت ثبت شد.", ticket: updatedTicket });
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

// POST /api/tickets/close
router.post("/close", async (req, res) => {
  try {
    const { ticket_id } = req.body;

    const ticket = await TicketRepository.findById(ticket_id);
    if (!ticket) {
      return res.status(404).json({ status: "error", error: "تیکت یافت نشد." });
    }

    await TicketRepository.update(ticket_id, { status: "closed" });

    return res.json({ status: "ok", message: "تیکت بسته شد." });
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

export default router;
