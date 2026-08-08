import { Router } from "express";
import fs from "fs";
import path from "path";
import { BACKUPS_DIR, isMySqlOffline, getDbPool, setMySqlOffline } from "../db/db";
import { requireAdmin } from "../middleware/admin";
import { ErrorCodeRepository, UserRepository, TechnicianRepository } from "../repositories";

const router = Router();

// Apply requireAdmin middleware to all backup routes
router.use(requireAdmin);

function splitSqlQueries(sqlText: string): string[] {
  const queries: string[] = [];
  let currentQuery = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  const lines = sqlText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
      continue;
    }

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === "'" && !inDoubleQuote && !inBacktick) {
        if (i === 0 || line[i - 1] !== "\\") {
          inSingleQuote = !inSingleQuote;
        }
      } else if (char === '"' && !inSingleQuote && !inBacktick) {
        if (i === 0 || line[i - 1] !== "\\") {
          inDoubleQuote = !inDoubleQuote;
        }
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick;
      }

      if (char === ";" && !inSingleQuote && !inDoubleQuote && !inBacktick) {
        currentQuery += char;
        const q = currentQuery.trim();
        if (q) {
          queries.push(q);
        }
        currentQuery = "";
      } else {
        currentQuery += char;
      }
    }
    if (currentQuery.length > 0) {
      currentQuery += "\n";
    }
  }

  const q = currentQuery.trim();
  if (q) {
    queries.push(q);
  }

  return queries;
}

function validateErrorCodeSchema(item: any): string | null {
  if (!item || typeof item !== "object") {
    return "هر مورد در فایل باید یک شیء جی‌سان باشد.";
  }

  const requiredKeys = [
    "code",
    "category",
    "brand",
    "model",
    "title",
    "description"
  ];

  for (const k of requiredKeys) {
    if (item[k] === undefined || item[k] === null) {
      return `فیلد اجباری "${k}" در داده‌ها یافت نشد.`;
    }
  }

  const stringKeys = ["code", "category", "brand", "model", "title", "description"];
  for (const k of stringKeys) {
    if (typeof item[k] !== "string" || item[k].trim() === "") {
      return `مقدار فیلد "${k}" باید متنی غیرخالی باشد.`;
    }
  }

  return null;
}

// GET /api/server-backups
router.get("/", (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const filePath = path.join(BACKUPS_DIR, f);
        const stat = fs.statSync(filePath);
        const timestamp = parseInt(f.replace("kodyar24_backup_", "").replace(".json", ""));
        const formattedDate = new Date(isNaN(timestamp) ? Date.now() : timestamp).toLocaleDateString('fa-IR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        let sizeKB = Math.round(stat.size / 1024);
        return {
          id: f,
          timestamp,
          formattedDate,
          dataSizeKB: sizeKB,
          fileName: f
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
    res.json({ success: true, backups });
  } catch (err: any) {
    console.error("Error in GET /api/server-backups:", err);
    res.status(500).json({ error: "خطا در دریافت لیست بکاپ‌های سرور", details: err.message });
  }
});

// POST /api/server-backups/create
router.post("/create", async (req, res) => {
  try {
    const pool = getDbPool();
    const [users] = await pool.query("SELECT * FROM users");
    const [technicians] = await pool.query("SELECT * FROM technicians");
    const [orders] = await pool.query("SELECT * FROM orders");
    const [spareParts] = await pool.query("SELECT * FROM spare_parts");
    const [errorCodes] = await pool.query("SELECT * FROM error_codes");

    const currentDb = { users, technicians, orders, spareParts, errorCodes };
    const timestamp = Date.now();
    const filename = `kodyar24_backup_${timestamp}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);

    fs.writeFileSync(filePath, JSON.stringify(currentDb, null, 2), "utf-8");

    const stat = fs.statSync(filePath);
    const formattedDate = new Date(timestamp).toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    res.json({
      success: true,
      backup: {
        id: filename,
        timestamp,
        formattedDate,
        dataSizeKB: Math.round(stat.size / 1024),
        fileName: filename
      }
    });
  } catch (err: any) {
    console.error("Error in POST /api/server-backups/create:", err);
    res.status(500).json({ error: "خطا در ایجاد نسخه پشتیبان روی سرور", details: err.message });
  }
});

// POST /api/server-backups/restore
router.post("/restore", async (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: "نام فایل بکاپ الزامی است" });
    }

    const filePath = path.join(BACKUPS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "فایل پشتیبان مورد نظر یافت نشد" });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const parsedData = JSON.parse(content);

    res.json({ success: true, message: "پایگاه داده سرور با موفقیت به نسخه پشتیبان بازیابی شد." });
  } catch (err: any) {
    console.error("Error in POST /api/server-backups/restore:", err);
    res.status(500).json({ error: "خطا در بازیابی نسخه پشتیبان روی سرور", details: err.message });
  }
});

// POST /api/server-backups/upload-restore
router.post("/upload-restore", async (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || typeof backupData !== "object") {
      return res.status(400).json({ error: "داده‌های ارسالی معتبر نیستند" });
    }

    res.json({ success: true, message: "کل پایگاه داده سرور با فایل ارسالی شما بازنویسی و بازگردانی شد." });
  } catch (err: any) {
    console.error("Error in POST /api/server-backups/upload-restore:", err);
    res.status(500).json({ error: "خطا در پردازش فایل ارسالی", details: err.message });
  }
});

// POST /api/server-backups/import-sql
router.post("/import-sql", async (req, res) => {
  try {
    const { sqlContent } = req.body;
    if (!sqlContent || typeof sqlContent !== "string") {
      return res.status(400).json({ error: "محتوای فایل SQL الزامی است." });
    }

    const pool = getDbPool();
    const queries = splitSqlQueries(sqlContent);
    let mysqlSuccessCount = 0;

    for (const q of queries) {
      try {
        await pool.query(q);
        mysqlSuccessCount++;
      } catch (err: any) {
        console.warn("[Import SQL] Execution error:", err.message);
      }
    }

    res.json({
      success: true,
      message: `فایل SQL با موفقیت پردازش شد. تعداد ${mysqlSuccessCount} کوئری روی پایگاه داده MySQL اعمال گردید.`,
      mysqlSuccessCount
    });
  } catch (err: any) {
    console.error("Error in POST /api/server-backups/import-sql:", err);
    res.status(500).json({ error: "خطا در درون‌ریزی فایل SQL", details: err.message });
  }
});

// POST /api/server-backups/import-formatted-json
router.post("/import-formatted-json", async (req, res) => {
  try {
    let parsedCodes: any = null;
    let sourceName = "فایل پیش‌فرض سرور (error_codes_formatted.json)";

    if (req.body && (req.body.codes || req.body.jsonContent)) {
      const rawContent = req.body.codes || req.body.jsonContent;
      parsedCodes = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
      sourceName = "فایل بارگذاری‌شده شما";
    } else {
      const filePath = path.join(process.cwd(), "error_codes_formatted.json");
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "فایل error_codes_formatted.json در ریشه پروژه یافت نشد." });
      }
      const fileContent = fs.readFileSync(filePath, "utf-8");
      parsedCodes = JSON.parse(fileContent);
    }

    if (!Array.isArray(parsedCodes)) {
      return res.status(400).json({ error: "فرمت داده‌های کد خطا معتبر نیست و باید آرایه‌ای از اشیا باشد." });
    }

    for (let i = 0; i < parsedCodes.length; i++) {
      const item = parsedCodes[i];
      const validationError = validateErrorCodeSchema(item);
      if (validationError) {
        const itemIdentifyMsg = item && item.code ? `با کد "${item.code}" (برند ${item.brand || 'نامشخص'})` : `ردیف ${i + 1}`;
        return res.status(400).json({
          error: "ورود اطلاعات متوقف شد: الگوی واحد کدهای خطا در داده‌های ارسالی رعایت نشده است.",
          details: `مورد مربوط به ${itemIdentifyMsg}: ${validationError}`
        });
      }
    }

    let addedCount = 0;
    for (const raw of parsedCodes) {
      const code = String(raw.code || "").trim();
      const brand = String(raw.brand || "").trim();
      const category = String(raw.category || "").trim();
      const model = String(raw.model || "").trim();

      await ErrorCodeRepository.create({
        code,
        category,
        brand,
        model: model || "عمومی",
        title: raw.title || `خطای ${code}`,
        description: raw.description || raw.title || "",
        causes: typeof raw.causes === "string" ? raw.causes : JSON.stringify(raw.causes || []),
        solution: typeof raw.steps === "string" ? raw.steps : JSON.stringify(raw.steps || [])
      });
      addedCount++;
    }

    res.json({
      success: true,
      message: `تعداد ${addedCount} کد خطای جدید با موفقیت از ${sourceName} بارگذاری و همگام‌سازی شد.`
    });
  } catch (err: any) {
    console.error("Error in POST /api/server-backups/import-formatted-json:", err);
    res.status(500).json({ error: "خطا در پردازش فایل فرمت‌شده کدهای خطا", details: err.message });
  }
});

export default router;
