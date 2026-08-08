import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();

// POST /api/directus-upload
router.post("/directus-upload", (req, res) => {
  try {
    const name = req.body.name || req.body.file_name || "image.jpg";
    const fileData = req.body.fileData || req.body.file_data || "";

    if (!fileData) {
      return res.status(400).json({ error: "دیتای فایل ارسال نشده است." });
    }

    // Extract base64 binary content
    const parts = fileData.split(",");
    const base64Str = parts.length > 1 ? parts[1] : fileData;
    const binaryData = Buffer.from(base64Str, "base64");

    if (!binaryData || binaryData.length === 0) {
      return res.status(400).json({ error: "کدگذاری فایل base64 نامعتبر است." });
    }

    // Enforce 5 MB file size limit
    if (binaryData.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد." });
    }

    // Validate extension: jpg, jpeg, png, pdf
    const ext = (path.extname(name).toLowerCase().replace(".", "") || "jpg");
    const allowedExts = ["jpg", "jpeg", "png", "pdf"];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ error: "فرمت فایل غیرمجاز است. فقط فایل‌های jpg، png و pdf مجاز هستند." });
    }

    const uniqueName = `directus_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, binaryData);

    const fileType = ext === "pdf" ? "application/pdf" : (ext === "png" ? "image/png" : "image/jpeg");

    return res.json({
      success: true,
      url: `/uploads/${uniqueName}`,
      id: `directus_asset_${Date.now()}`,
      name,
      type: fileType
    });
  } catch (err: any) {
    console.error("Error in directus-upload:", err);
    return res.status(500).json({ error: "خطای سیستمی آپلودر", details: err.message });
  }
});

export default router;
