import { Router } from "express";
import { getCurrentUserAsync } from "../db/db";
import { ProblemRepository } from "../repositories";
import { sendSuccess, sendError } from "../utils/response";
import { logger } from "../utils/logger";

const router = Router();

// GET /api/problems/search
router.get("/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").toLowerCase().trim();
    const brand = String(req.query.brand || "").toLowerCase().trim();
    const category = String(req.query.category || "").toLowerCase().trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));

    let problems = await ProblemRepository.findAll();

    if (brand) {
      problems = problems.filter((item: any) => String(item.brand || "").toLowerCase().includes(brand));
    }
    if (category) {
      problems = problems.filter((item: any) => String(item.category || "").toLowerCase().includes(category));
    }
    if (query) {
      problems = problems.filter(
        (item: any) =>
          String(item.title || "").toLowerCase().includes(query) ||
          String(item.symptoms?.join(" ") || "").toLowerCase().includes(query) ||
          String(item.causes?.join(" ") || "").toLowerCase().includes(query)
      );
    }

    const total = problems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedResults = problems.slice(startIndex, startIndex + limit);

    return sendSuccess(res, {
      results: paginatedResults,
      pagination: { total, page, limit, totalPages }
    }, {
      page, limit, total, totalPages,
      results: paginatedResults,
      problems: paginatedResults
    });
  } catch (err: any) {
    logger.error({ err }, "Error in problems search route");
    return sendError(res, err.message, 500, 500);
  }
});

// GET /api/problems/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const problem = await ProblemRepository.findById(id);
    if (!problem) {
      return sendError(res, "مشکل مورد نظر یافت نشد.", 404, 404);
    }

    return sendSuccess(res, { problem }, { problem });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// POST /api/problems (Admin)
router.post("/", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر مجاز است.", 403, 403);
    }

    const newProblem = await ProblemRepository.create(req.body);

    return sendSuccess(res, { problem: newProblem }, {
      message: "مشکل جدید با موفقیت ثبت گردید.",
      problem: newProblem
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// PUT /api/problems/:id (Admin)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر مجاز است.", 403, 403);
    }

    const existing = await ProblemRepository.findById(id);
    if (!existing) {
      return sendError(res, "مشکل مورد نظر یافت نشد.", 404, 404);
    }

    const updated = await ProblemRepository.update(id, req.body);

    return sendSuccess(res, { problem: updated }, {
      message: "مشکل مورد نظر با موفقیت بروزرسانی گردید.",
      problem: updated
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// DELETE /api/problems/:id (Admin)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر مجاز است.", 403, 403);
    }

    await ProblemRepository.deleteById(id);

    return sendSuccess(res, { message: "مشکل با موفقیت حذف گردید." }, { message: "مشکل با موفقیت حذف گردید." });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

export default router;
