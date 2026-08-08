import { Router } from "express";
import { getCurrentUserAsync, logActivity } from "../db/db";
import { PaymentRepository, SubscriptionRepository } from "../repositories";
import { ZARINPAL_MERCHANT_ID, ZARINPAL_REQUEST_URL, ZARINPAL_VERIFY_URL, ZARINPAL_START_PAY_URL } from "../services/payment";
import { logger } from "../utils/logger";
import { sendSuccess, sendError } from "../utils/response";

const router = Router();

// GET /api/subscription/plans
router.get("/subscription/plans", (req, res) => {
  const plans = [
    {
      id: "bronze_1m",
      title: "اشتراک برنزی (۱ ماهه)",
      price: 150000,
      formattedPrice: "150,000 تومان",
      durationDays: 30,
      description: "دسترسی کامل به ارورکدهای پایه و نقشه ارورها",
      features: ["مشاهده ارور کدهای عمومی", "عیب‌یابی هوشمند هوش مصنوعی", "پشتیبانی تیکتی"]
    },
    {
      id: "silver_3m",
      title: "اشتراک نقره‌ای (۳ ماهه)",
      price: 380000,
      formattedPrice: "380,000 تومان",
      durationDays: 90,
      description: "صرفه اقتصادی و دسترسی کامل به فایل‌های تخصصی",
      features: ["تمامی امکانات طرح برنزی", "تخفیف ۱۰٪ خرید قطعات", "اولویت در پاسخگویی پشتیبانی"]
    },
    {
      id: "gold_12m",
      title: "اشتراک طلایی ویژه (۱ ساله)",
      price: 1200000,
      formattedPrice: "1,200,000 تومان",
      durationDays: 365,
      description: "دسترسی نامحدود VIP به کلیه خدمات آموزشی و ابزارها",
      features: ["دسترسی کامل بی‌نهایت به تمام ارورکدها", "تخفیف ۱۵٪ در خرید قطعات", "پشتیبانی اختصاصی تلفنی VIP"]
    }
  ];

  return sendSuccess(res, { plans }, { plans });
});

// POST /api/payment/request
router.post("/payment/request", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);

    if (!user) {
      return sendError(res, "برای خرید اشتراک ابتدا وارد حساب کاربری خود شوید.", 401, 401);
    }

    const { plan_id, amount, is_mock } = req.body;
    if (!plan_id || !amount) {
      return sendError(res, "شناسه پلن و مبلغ الزامی هستند.", 400, 400);
    }

    const isDev = process.env.NODE_ENV === "development";

    // Handle Mock Gateway strictly in development mode
    if (is_mock || isDev) {
      if (!isDev && !is_mock) {
        return sendError(res, "درگاه ساختگی فقط در محیط توسعه فعال می‌باشد.", 403, 403);
      }

      const mockAuthority = `MOCK_AUTH_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await PaymentRepository.create({
        user_id: user.id,
        related_type: "subscription",
        amount: parseInt(amount),
        authority: mockAuthority,
        status: "pending",
        payment_method: "mock_gateway"
      });

      const callbackUrl = `/api/payment/verify?Authority=${mockAuthority}&Status=OK`;
      logger.info({ userId: user.id, mockAuthority }, "Created mock payment request in development mode");

      return sendSuccess(res, {
        payment_url: callbackUrl,
        authority: mockAuthority,
        is_mock: true
      }, {
        message: "لینک درگاه آزمایشی توسعه ایجاد شد.",
        payment_url: callbackUrl,
        authority: mockAuthority
      });
    }

    // Real Zarinpal Gateway Integration
    const callbackUrl = `${req.protocol}://${req.get("host")}/api/payment/verify`;

    const requestData = {
      merchant_id: ZARINPAL_MERCHANT_ID,
      amount: parseInt(amount),
      description: `خرید اشتراک ${plan_id} توسط کاربر ${user.phone}`,
      callback_url: callbackUrl,
      metadata: {
        mobile: user.phone,
        user_id: user.id,
        plan_id: plan_id
      }
    };

    const response = await fetch(ZARINPAL_REQUEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData)
    });

    const data = await response.json();

    if (data.data && data.data.code === 100) {
      const authority = data.data.authority;

      await PaymentRepository.create({
        user_id: user.id,
        related_type: "subscription",
        amount: parseInt(amount),
        authority,
        status: "pending",
        payment_method: "zarinpal"
      });

      logger.info({ userId: user.id, authority }, "Created Zarinpal payment request");

      return sendSuccess(res, {
        payment_url: `${ZARINPAL_START_PAY_URL}${authority}`,
        authority
      }, {
        payment_url: `${ZARINPAL_START_PAY_URL}${authority}`,
        authority
      });
    } else {
      logger.error({ data }, "Zarinpal payment request failed");
      return sendError(res, "خطا در برقراری ارتباط با درگاه زرین‌پال.", 400, 400);
    }
  } catch (err: any) {
    logger.error({ err }, "Payment request exception");
    return sendError(res, err.message, 500, 500);
  }
});

// GET /api/payment/verify
router.get("/payment/verify", async (req, res) => {
  try {
    const { Authority, Status } = req.query;

    if (!Authority || Status !== "OK") {
      return res.redirect("/payment-result?status=failed&reason=canceled");
    }

    const authorityStr = String(Authority);
    const payment = await PaymentRepository.findByAuthority(authorityStr);

    if (!payment) {
      return res.redirect("/payment-result?status=failed&reason=not_found");
    }

    // IDEMPOTENCY CHECK: If already completed, do NOT add duplicate subscription
    if (payment.status === "completed") {
      logger.info({ authority: authorityStr }, "Payment already verified previously (Idempotent call)");
      return res.redirect(`/payment-result?status=success&ref_id=${payment.ref_id || "PREVIOUSLY_VERIFIED"}`);
    }

    // Handle Mock payment verification in dev mode
    if (authorityStr.startsWith("MOCK_AUTH_")) {
      const mockRefId = `REF_MOCK_${Date.now()}`;
      await PaymentRepository.update(payment.id, {
        status: "completed",
        ref_id: mockRefId
      });

      const days = 30;
      const endDate = new Date(Date.now() + days * 86400000);

      await SubscriptionRepository.create({
        user_id: payment.user_id,
        plan_type: "bronze",
        start_date: new Date(),
        end_date: endDate,
        status: "active"
      });

      logger.info({ userId: payment.user_id, mockRefId }, "Completed mock payment and granted subscription");
      return res.redirect(`/payment-result?status=success&ref_id=${mockRefId}`);
    }

    // Real Zarinpal verification
    const verifyData = {
      merchant_id: ZARINPAL_MERCHANT_ID,
      amount: payment.amount,
      authority: authorityStr
    };

    const response = await fetch(ZARINPAL_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyData)
    });

    const data = await response.json();

    if (data.data && (data.data.code === 100 || data.data.code === 101)) {
      await PaymentRepository.update(payment.id, {
        status: "completed",
        ref_id: String(data.data.ref_id)
      });

      const days = 30;
      const endDate = new Date(Date.now() + days * 86400000);

      await SubscriptionRepository.create({
        user_id: payment.user_id,
        plan_type: "bronze",
        start_date: new Date(),
        end_date: endDate,
        status: "active"
      });

      logger.info({ userId: payment.user_id, refId: data.data.ref_id }, "Zarinpal payment verified and subscription granted");
      return res.redirect(`/payment-result?status=success&ref_id=${data.data.ref_id}`);
    } else {
      await PaymentRepository.update(payment.id, { status: "failed" });
      logger.warn({ authority: authorityStr, errors: data.errors }, "Zarinpal payment verification failed");
      return res.redirect(`/payment-result?status=failed&code=${data.errors?.code || "unknown"}`);
    }
  } catch (err: any) {
    logger.error({ err }, "Payment verify exception");
    return res.redirect("/payment-result?status=failed&reason=server_error");
  }
});

// 7) POST /api/payment/card-verify & /api/payments/card-to-card/submit
const handleCardToCardSubmit = async (req: any, res: any) => {
  try {
    const user = await getCurrentUserAsync(req);
    const { ref_id, card_holder, amount, plan_id, tracking_code, receipt_code } = req.body;

    const ref = (ref_id || tracking_code || receipt_code || "").trim();
    if (!ref || !amount) {
      return sendError(res, "شماره پیگیری و مبلغ الزامی هستند.", 400, 400);
    }

    const newPayment = await PaymentRepository.create({
      user_id: user ? user.id : null,
      related_type: plan_id ? "subscription" : "other",
      amount: parseInt(amount),
      authority: `C2C_${ref}_${Date.now()}`,
      ref_id: ref,
      status: "pending", // ALWAYS pending until admin approval
      payment_method: "card_to_card"
    });

    if (user) {
      await logActivity(user.id, "card_to_card_submit", req, `ثبت فیش کارت به کارت کد پیگیری: ${ref}`);
    }

    logger.info({ userId: user?.id, ref }, "Card-to-card payment request submitted with pending status");

    return sendSuccess(res, { payment: newPayment }, {
      status: "ok",
      message: "فیش پرداخت کارت به کارت ثبت شد و پس از بررسی و تایید ادمین، اشتراک شما فعال می‌گردد.",
      payment: newPayment
    });
  } catch (err: any) {
    logger.error({ err }, "Card-to-card submit exception");
    return sendError(res, err.message, 500, 500);
  }
};

router.post("/payment/card-verify", handleCardToCardSubmit);
router.post("/payment/verify-card-to-card", handleCardToCardSubmit);
router.post("/payments/card-to-card/submit", handleCardToCardSubmit);
router.post("/payment/card-to-card/submit", handleCardToCardSubmit);

// POST /api/payment/admin-card-to-card (Confirm C2C Payment by Admin)
router.post("/payment/admin-card-to-card", async (req, res) => {
  try {
    const admin = await getCurrentUserAsync(req);
    if (!admin || admin.role !== "admin") {
      return sendError(res, "فقط مدیر دسترسی دارد.", 403, 403);
    }

    const { payment_id, action } = req.body;
    if (!payment_id || !["approve", "reject"].includes(action)) {
      return sendError(res, "شناسه پرداخت و عملیات نامعتبر است.", 400, 400);
    }

    const pay = await PaymentRepository.findById(payment_id);
    if (!pay) {
      return sendError(res, "پرداخت یافت نشد.", 404, 404);
    }

    // IDEMPOTENCY CHECK: If payment is already completed or rejected, do not re-process
    if (pay.status === "completed" && action === "approve") {
      return sendSuccess(res, { message: "این پرداخت قبلاً تایید شده است." }, { message: "این پرداخت قبلاً تایید شده است." });
    }

    if (action === "approve") {
      await PaymentRepository.update(pay.id, { status: "completed" });

      if (pay.related_type === "subscription" && pay.user_id) {
        const endDate = new Date(Date.now() + 30 * 86400000);
        await SubscriptionRepository.create({
          user_id: pay.user_id,
          plan_type: "bronze",
          start_date: new Date(),
          end_date: endDate,
          status: "active"
        });
        logger.info({ userId: pay.user_id, paymentId: pay.id }, "Admin approved C2C payment and activated subscription");
      }
    } else {
      await PaymentRepository.update(pay.id, { status: "failed" });
      logger.info({ paymentId: pay.id }, "Admin rejected C2C payment");
    }

    return sendSuccess(res, { message: `پرداخت با موفقیت ${action === "approve" ? "تایید" : "رد"} شد.` }, {
      message: `پرداخت با موفقیت ${action === "approve" ? "تایید" : "رد"} شد.`
    });
  } catch (err: any) {
    logger.error({ err }, "Admin C2C approval exception");
    return sendError(res, err.message, 500, 500);
  }
});

// POST /api/payment/verify-bazaar & /api/payment/bazaar-verify (Bazaar Payment Disabled)
const handleBazaarDisabled = async (req: any, res: any) => {
  return sendError(res, "درگاه پرداخت کافه بازار در حال حاضر غیرفعال می‌باشد.", 400, 400);
};

router.post("/payment/verify-bazaar", handleBazaarDisabled);
router.post("/payment/bazaar-verify", handleBazaarDisabled);

export default router;
