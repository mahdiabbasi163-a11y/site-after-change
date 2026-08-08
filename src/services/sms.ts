import { SmsLogRepository } from "../repositories/sms_logs";

export async function sendSmsNotification(phone: string, message: string, type: string = "info") {
  try {
    const logItem = await SmsLogRepository.create({
      recipient_phone: phone,
      message_text: message,
      provider: "ghasedak",
      status: "sent"
    });

    return { success: true, logItem };
  } catch (err: any) {
    console.warn("[SMS Service] Warning sending SMS:", err.message);
    return { success: false, error: err.message };
  }
}
