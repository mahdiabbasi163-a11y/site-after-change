import { Router } from "express";
import { getCurrentUserAsync } from "../db/db";
import { sendSmsNotification } from "../services/sms";
import { SmsLogRepository } from "../repositories";

const router = Router();

// POST /api/sms/send
router.post("/send", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);

    if (!user || user.role !== "admin") {
      return res.status(403).json({ status: "error", error: "فقط مدیر مجاز به ارسال پیامک انبوه است." });
    }

    const { phone, message, type } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ status: "error", error: "شماره گیرنده و متن پیام الزامی است." });
    }

    const result = await sendSmsNotification(phone, message, type || "custom");
    if (result.success) {
      return res.json({ status: "ok", message: "پیامک با موفقیت ارسال شد.", log: result.logItem });
    } else {
      return res.status(500).json({ status: "error", error: result.error });
    }
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

// GET /api/sms/logs
router.get("/logs", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);

    if (!user || user.role !== "admin") {
      return res.status(403).json({ status: "error", error: "فقط مدیر دسترسی دارد." });
    }

    const smsLogs = await SmsLogRepository.findAll();
    return res.json({ status: "ok", smsLogs });
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

export default router;
