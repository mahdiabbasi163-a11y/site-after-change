import { Router } from "express";
import { getCurrentUserAsync } from "../db/db";
import { ErrorCodeRepository, ProblemRepository, SettingsRepository, SparePartRepository, TechnicianRepository, UsageCounterRepository } from "../repositories";
import { sendError, sendSuccess } from "../utils/response";

const router = Router();

// 1) GET /api/get-database — Lightweight main screen database query
router.get("/get-database", async (req, res) => {
  try {
    const errorCodes = await ErrorCodeRepository.findAll();
    const problems = await ProblemRepository.findAll();
    const spareParts = await SparePartRepository.findAll();
    const allTechnicians = await TechnicianRepository.findAll();
    const approvedTechnicians = allTechnicians.filter(
      (t: any) => t.status === "active" || t.status === "approved" || !t.status
    );

    return sendSuccess(res, {
      error_codes: errorCodes,
      errorCodes,
      problems,
      spare_parts: spareParts,
      spareParts,
      technicians: approvedTechnicians,
      common_problems: problems,
      commonProblems: problems
    }, {
      error_codes: errorCodes,
      errorCodes,
      problems,
      spare_parts: spareParts,
      spareParts,
      technicians: approvedTechnicians,
      common_problems: problems,
      commonProblems: problems
    });
  } catch (err: any) {
    return sendError(res, "خطا در دریافت اطلاعات دیتابیس: " + err.message, 500, 500);
  }
});

// GET /api/common-problems
router.get("/common-problems", async (req, res) => {
  try {
    const problems = await ProblemRepository.findAll();
    return sendSuccess(res, { problems, commonProblems: problems, common_problems: problems }, { problems, commonProblems: problems, common_problems: problems });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// 4) GET /api/free/status
router.get("/free/status", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    const rawIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "guest_user").toString();
    const clientIp = rawIp.split(",")[0].trim();
    const userIdentifier = user ? user.id : clientIp;

    if (user && (user.role === "admin" || user.role === "technician" || user.role === "super_admin" || user.is_super_admin)) {
      return sendSuccess(res, { used: 0, limit: 99999, remaining: 99999, error_count: 0, problem_count: 0, max_free: 99999 }, { used: 0, limit: 99999, remaining: 99999, error_count: 0, problem_count: 0, max_free: 99999 });
    }

    const used = await UsageCounterRepository.getUsage(userIdentifier, "error_code_search");
    const limit = 500;
    const remaining = Math.max(0, limit - used);

    return sendSuccess(res, {
      used,
      limit,
      remaining,
      error_count: used,
      problem_count: used,
      max_free: limit
    }, {
      used,
      limit,
      remaining,
      error_count: used,
      problem_count: used,
      max_free: limit
    });
  } catch (err: any) {
    return sendSuccess(res, { error_count: 0, problem_count: 0, remaining: 500, limit: 500 }, { error_count: 0, problem_count: 0, remaining: 500, limit: 500 });
  }
});

// 4) POST /api/free/use
router.post("/free/use", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    const rawIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "guest_user").toString();
    const clientIp = rawIp.split(",")[0].trim();
    const userIdentifier = user ? user.id : clientIp;

    if (user && (user.role === "admin" || user.role === "technician" || user.role === "super_admin" || user.is_super_admin)) {
      return sendSuccess(res, { allowed: true, used: 0, limit: 99999, remaining: 99999, error_count: 0, problem_count: 0 }, { allowed: true, used: 0, limit: 99999, remaining: 99999, error_count: 0, problem_count: 0 });
    }

    const result = await UsageCounterRepository.checkAndIncrement(userIdentifier, "error_code_search", 500);
    const remaining = Math.max(0, 500 - result.count);

    return sendSuccess(res, {
      allowed: result.allowed,
      used: result.count,
      limit: result.limit,
      remaining,
      error_count: result.count,
      problem_count: result.count
    }, {
      allowed: result.allowed,
      used: result.count,
      limit: result.limit,
      remaining,
      error_count: result.count,
      problem_count: result.count
    });
  } catch (err: any) {
    return sendSuccess(res, { allowed: true, used: 1, limit: 500, remaining: 499 }, { allowed: true, used: 1, limit: 500, remaining: 499 });
  }
});

// GET /api/free-views
router.get("/free-views", (req, res) => {
  return sendSuccess(res, { viewed_ids: [] }, { viewed_ids: [] });
});

// GET /api/tech-docs
router.get("/tech-docs", (req, res) => {
  return sendSuccess(res, { techDocs: [] }, { techDocs: [] });
});

// GET /api/device/brands
router.get("/device/brands", (req, res) => {
  const brands = [
    { name: "ایران رادیاتور", category: "پکیج دیواری" },
    { name: "بوتان", category: "پکیج دیواری" },
    { name: "ایساتیس", category: "پکیج دیواری" },
    { name: "تاچی", category: "پکیج دیواری" },
    { name: "سامسونگ", category: "لوازم خانگی" },
    { name: "ال‌جی", category: "لوازم خانگی" },
    { name: "اسنوا", category: "لوازم خانگی" },
    { name: "پارس خزر", category: "لوازم خانگی" }
  ];
  return sendSuccess(res, { brands }, { brands });
});

// POST /api/sync & POST /api/sync-database
const handleSyncDatabase = async (req: any, res: any) => {
  try {
    const { spareParts, errorCodes, commonProblems, settings } = req.body || {};

    if (Array.isArray(spareParts)) {
      for (const p of spareParts) {
        if (!p || (!p.id && !p.name && !p.title)) continue;
        const id = p.id;
        let existing = null;
        if (id) {
          existing = await SparePartRepository.findById(id);
        }
        if (existing) {
          await SparePartRepository.update(id, p);
        } else {
          await SparePartRepository.create(p);
        }
      }
    }

    if (Array.isArray(errorCodes)) {
      for (const e of errorCodes) {
        if (!e || (!e.id && !e.code)) continue;
        const id = e.id;
        let existing = null;
        if (id) {
          existing = await ErrorCodeRepository.findById(id);
        }
        if (existing) {
          await ErrorCodeRepository.update(id, e);
        } else {
          await ErrorCodeRepository.create(e);
        }
      }
    }

    if (Array.isArray(commonProblems)) {
      for (const prob of commonProblems) {
        if (!prob || (!prob.id && !prob.title)) continue;
        const id = prob.id;
        let existing = null;
        if (id) {
          existing = await ProblemRepository.findById(id);
        }
        if (existing) {
          await ProblemRepository.update(id, prob);
        } else {
          await ProblemRepository.create(prob);
        }
      }
    }

    if (settings && typeof settings === "object") {
      for (const [key, val] of Object.entries(settings)) {
        await SettingsRepository.setSetting(key, val);
      }
    }

    return sendSuccess(res, { message: "همگام‌سازی دیتابیس با موفقیت انجام شد" }, { message: "Database sync successful" });
  } catch (err: any) {
    console.error("[POST /api/sync Error]", err.message);
    return sendError(res, "خطا در همگام‌سازی با دیتابیس: " + err.message, 500, 500);
  }
};

router.post("/sync", handleSyncDatabase);
router.post("/sync-database", handleSyncDatabase);

export default router;
