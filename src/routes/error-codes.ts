import { Router } from "express";
import { getCurrentUserAsync, getSubscriptionForUserAsync } from "../db/db";
import { ErrorCodeRepository, UsageCounterRepository } from "../repositories";
import { sendSuccess, sendError } from "../utils/response";
import { logger } from "../utils/logger";

const router = Router();

// GET /api/error-codes/search
router.get("/search", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    const rawIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "guest_user").toString();
    const clientIp = rawIp.split(",")[0].trim();
    const userIdentifier = user ? user.id : clientIp;

    // Check user subscription status server-side
    let hasActiveSub = false;
    if (user) {
      if (user.role === "admin" || user.role === "technician" || user.role === "super_admin" || user.is_super_admin) {
        hasActiveSub = true;
      } else {
        const sub = await getSubscriptionForUserAsync(user.id);
        if (sub && (sub.is_active || sub.status === "active")) {
          hasActiveSub = true;
        }
      }
    }

    // Enforce server-side usage counter for free/unsubscribed users
    if (!hasActiveSub) {
      const FREE_LIMIT = 500;
      const usage = await UsageCounterRepository.checkAndIncrement(userIdentifier, "error_code_search", FREE_LIMIT);
      if (!usage.allowed) {
        logger.info({ userIdentifier }, "Free usage limit exceeded for error_code_search");
        return res.status(402).json({
          status: "error",
          code: 402,
          error: `سقف استفاده رایگان روزانه شما (${FREE_LIMIT} جستجو) به پایان رسیده است. لطفاً جهت دسترسی نامحدود، اشتراک تهیه فرمایید.`,
          usage_limit_reached: true
        });
      }
    }

    res.setHeader("Cache-Control", "public, max-age=3600");

    const query = String(req.query.q || "").toLowerCase().trim();
    const brand = String(req.query.brand || "").toLowerCase().trim();
    const category = String(req.query.category || "").toLowerCase().trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));

    let errorCodes = await ErrorCodeRepository.findAll();

    if (brand) {
      errorCodes = errorCodes.filter((item: any) => String(item.brand || "").toLowerCase().includes(brand));
    }
    if (category) {
      errorCodes = errorCodes.filter((item: any) => String(item.category || "").toLowerCase().includes(category));
    }
    if (query) {
      errorCodes = errorCodes.filter(
        (item: any) =>
          String(item.code || "").toLowerCase().includes(query) ||
          String(item.title || "").toLowerCase().includes(query) ||
          String(item.description || "").toLowerCase().includes(query)
      );
    }

    const total = errorCodes.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedResults = errorCodes.slice(startIndex, startIndex + limit);

    return sendSuccess(res, {
      results: paginatedResults,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    }, {
      page,
      limit,
      total,
      totalPages,
      results: paginatedResults,
      errorCodes: paginatedResults
    });
  } catch (err: any) {
    logger.error({ err }, "Error in error-codes search route");
    return sendError(res, err.message, 500, 500);
  }
});

// GET /api/error-codes/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const errorCode = await ErrorCodeRepository.findById(id);
    if (!errorCode) {
      return sendError(res, "کد خطا یافت نشد.", 404, 404);
    }

    return sendSuccess(res, { errorCode }, { errorCode });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// POST /api/error-codes (Admin)
router.post("/", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر مجاز است.", 403, 403);
    }

    const newCode = await ErrorCodeRepository.create(req.body);

    return sendSuccess(res, { errorCode: newCode }, {
      message: "کد خطا با موفقیت ایجاد شد.",
      errorCode: newCode
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// PUT /api/error-codes/:id (Admin)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر مجاز است.", 403, 403);
    }

    const existing = await ErrorCodeRepository.findById(id);
    if (!existing) {
      return sendError(res, "کد خطا یافت نشد.", 404, 404);
    }

    const updated = await ErrorCodeRepository.update(id, req.body);

    return sendSuccess(res, { errorCode: updated }, {
      message: "کد خطا با موفقیت ویرایش شد.",
      errorCode: updated
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// DELETE /api/error-codes/:id (Admin)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر مجاز است.", 403, 403);
    }

    await ErrorCodeRepository.deleteById(id);

    return sendSuccess(res, { message: "کد خطا حذف گردید." }, { message: "کد خطا حذف گردید." });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

export default router;
