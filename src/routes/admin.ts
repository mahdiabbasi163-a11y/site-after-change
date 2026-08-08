import { Router } from "express";
import { getCurrentUserAsync, hashPassword, reportError, getDbPool } from "../db/db";
import { requireAdmin } from "../middleware/admin";
import { UserRepository, TechnicianRepository } from "../repositories";
import { normalizePhone, isValidIranianMobile } from "../utils/phone";
import { sendSuccess, sendError } from "../utils/response";
import { logger } from "../utils/logger";

const router = Router();

// Apply requireAdmin middleware to all admin endpoints
router.use(requireAdmin);

// GET /api/admin/users (Paginated with Server-side Search)
router.get("/users", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);

    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر ارشد دسترسی دارد.", 403, 403);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const searchQuery = String(req.query.q || req.query.query || "").toLowerCase().trim();

    let allUsers = await UserRepository.findAll();

    if (searchQuery) {
      allUsers = allUsers.filter(
        (u: any) =>
          String(u.full_name || "").toLowerCase().includes(searchQuery) ||
          String(u.phone || "").includes(searchQuery) ||
          String(u.city || "").toLowerCase().includes(searchQuery) ||
          String(u.role || "").toLowerCase().includes(searchQuery)
      );
    }

    const safeUsers = allUsers.map((u: any) => {
      const { password_hash, password, ...safeUser } = u;
      return safeUser;
    });

    const total = safeUsers.length;
    const startIndex = (page - 1) * limit;
    const paginatedUsers = safeUsers.slice(startIndex, startIndex + limit);

    return sendSuccess(res, {
      users: paginatedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    }, {
      users: paginatedUsers
    });
  } catch (err: any) {
    logger.error({ err }, "Admin get users exception");
    return sendError(res, err.message, 500, 500);
  }
});

// POST /api/admin/users
router.post("/users", async (req, res) => {
  try {
    const admin = await getCurrentUserAsync(req);

    if (!admin || admin.role !== "admin") {
      return sendError(res, "فقط مدیر ارشد دسترسی دارد.", 403, 403);
    }

    const rawPhone = String(req.body.phone || "").trim();
    const phone = normalizePhone(rawPhone);
    const { password, full_name, role, city } = req.body;

    if (!phone || !isValidIranianMobile(phone)) {
      return sendError(res, "شماره همراه وارد شده معتبر نیست.", 400, 400);
    }

    const existing = await UserRepository.findByPhone(phone);
    if (existing) {
      return sendError(res, "کاربری با این شماره همراه قبلاً ثبت شده است.", 409, 409);
    }

    const newUser = await UserRepository.create({
      id: `us_${Date.now()}`,
      phone,
      password_hash: hashPassword(password || "123456"),
      full_name: full_name || "کاربر جدید",
      role: role || "client",
      city: city || "تهران",
      wallet_balance: 0
    });

    const { password_hash, ...safeUser } = newUser;
    return sendSuccess(res, { user: safeUser }, {
      message: "کاربر با موفقیت ایجاد شد.",
      user: safeUser
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// PUT /api/admin/users/:id
router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await getCurrentUserAsync(req);

    if (!admin || admin.role !== "admin") {
      return sendError(res, "فقط مدیر ارشد دسترسی دارد.", 403, 403);
    }

    const existing = await UserRepository.findById(id);
    if (!existing) {
      return sendError(res, "کاربر یافت نشد.", 404, 404);
    }

    const updates = { ...req.body };
    if (req.body.phone) {
      updates.phone = normalizePhone(req.body.phone);
    }
    if (req.body.password) {
      updates.password_hash = hashPassword(req.body.password);
    }

    const updated = await UserRepository.update(id, updates);

    const { password_hash, password, ...safeUser } = updated;
    return sendSuccess(res, { user: safeUser }, {
      message: "اطلاعات کاربر بروزرسانی شد.",
      user: safeUser
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await getCurrentUserAsync(req);

    if (!admin || admin.role !== "admin") {
      return sendError(res, "فقط مدیر ارشد دسترسی دارد.", 403, 403);
    }

    await UserRepository.deleteById(id);

    return sendSuccess(res, { message: "کاربر با موفقیت حذف گردید." }, { message: "کاربر با موفقیت حذف گردید." });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// GET /api/admin/technicians (Paginated with Server-side Search)
router.get("/technicians", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const searchQuery = String(req.query.q || req.query.query || "").toLowerCase().trim();

    let allTechs = await TechnicianRepository.findAll();

    if (searchQuery) {
      allTechs = allTechs.filter(
        (t: any) =>
          String(t.full_name || t.name || "").toLowerCase().includes(searchQuery) ||
          String(t.phone || "").includes(searchQuery) ||
          String(t.city || "").toLowerCase().includes(searchQuery) ||
          String(t.specialties || "").toLowerCase().includes(searchQuery)
      );
    }

    const total = allTechs.length;
    const startIndex = (page - 1) * limit;
    const paginatedTechs = allTechs.slice(startIndex, startIndex + limit);

    return sendSuccess(res, {
      technicians: paginatedTechs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    }, {
      technicians: paginatedTechs
    });
  } catch (err: any) {
    logger.error({ err }, "Admin get technicians exception");
    return sendError(res, err.message, 500, 500);
  }
});

// POST /api/admin/technicians
router.post("/technicians", async (req, res) => {
  try {
    const admin = await getCurrentUserAsync(req);

    if (!admin || admin.role !== "admin") {
      return sendError(res, "فقط مدیر دسترسی دارد.", 403, 403);
    }

    const { name, phone: rawPhone, specialty, activeLocation, rating, city } = req.body;
    const phone = normalizePhone(rawPhone);

    if (!name || !phone || !isValidIranianMobile(phone)) {
      return sendError(res, "نام و شماره همراه معتبر تکنسین الزامی است.", 400, 400);
    }

    const techId = `tech_${Date.now()}`;
    const newTech = await TechnicianRepository.create({
      id: techId,
      full_name: name,
      phone,
      city: city || activeLocation || "تهران",
      specialties: Array.isArray(specialty) ? JSON.stringify(specialty) : (specialty || "پکیج و لوازم خانگی"),
      status: "active",
      wallet_balance: 0
    });

    const userExisting = await UserRepository.findByPhone(phone);
    if (!userExisting) {
      await UserRepository.create({
        id: techId,
        phone,
        password_hash: hashPassword("123456"),
        full_name: name,
        role: "technician",
        city: city || activeLocation || "تهران"
      });
    } else {
      await UserRepository.update(userExisting.id, { role: "technician" });
    }

    return sendSuccess(res, { technician: newTech }, {
      message: "تکنسین جدید با موفقیت اضافه شد.",
      technician: newTech
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// GET /api/admin/activity-logs
router.get("/activity-logs", async (req, res) => {
  try {
    const admin = await getCurrentUserAsync(req);

    if (!admin || admin.role !== "admin") {
      return sendError(res, "فقط مدیر دسترسی دارد.", 403, 403);
    }

    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 500");
    return sendSuccess(res, { logs: rows }, { logs: rows });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// GET /api/admin/export-all-data
router.get("/export-all-data", async (req, res) => {
  try {
    const admin = await getCurrentUserAsync(req);

    if (!admin || admin.role !== "admin") {
      return sendError(res, "فقط مدیر دسترسی دارد.", 403, 403);
    }

    const users = await UserRepository.findAll();
    const technicians = await TechnicianRepository.findAll();

    const exportData = {
      users,
      technicians,
      exported_at: new Date().toISOString()
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=kodyar24_export_${Date.now()}.json`);
    return res.send(JSON.stringify(exportData, null, 2));
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// GET /api/error-logs/list
router.get("/error-logs/list", async (req, res) => {
  try {
    const admin = await getCurrentUserAsync(req);

    if (!admin || admin.role !== "admin") {
      return sendError(res, "فقط مدیر دسترسی دارد.", 403, 403);
    }

    const pool = getDbPool();
    const [rows] = await pool.query("SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 500");
    return sendSuccess(res, { errorLogs: rows }, { errorLogs: rows });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// POST /api/error-logs/report
router.post("/error-logs/report", async (req, res) => {
  try {
    const { errorMessage, stackTrace, url, userId } = req.body;
    await reportError(errorMessage || "خطای ناشناخته کلاینت", stackTrace || "", url || "", userId || "guest");
    return sendSuccess(res, { message: "گزارش خطا ثبت گردید." }, { message: "گزارش خطا ثبت گردید." });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

export default router;
