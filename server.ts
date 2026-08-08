import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import compression from "compression";
import { createServer as createViteServer } from "vite";

// Routes imports
import authRouter from "./src/routes/auth";
import paymentRouter from "./src/routes/payment";
import walletRouter from "./src/routes/wallet";
import repairsRouter from "./src/routes/repairs";
import ordersRouter from "./src/routes/orders";
import storeRouter from "./src/routes/store";
import ticketsRouter from "./src/routes/tickets";
import errorCodesRouter from "./src/routes/error-codes";
import problemsRouter from "./src/routes/problems";
import geminiRouter from "./src/routes/gemini";
import smsRouter from "./src/routes/sms";
import adminRouter from "./src/routes/admin";
import backupsRouter from "./src/routes/backups";
import syncRouter from "./src/routes/sync";
import uploadRouter from "./src/routes/upload";

import { checkDbConnection } from "./src/db/db";

if (fs.existsSync("env")) {
  dotenv.config({ path: "env" });
} else {
  dotenv.config();
}

const app = express();
app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ----------------------------------------------------
// SEO & PWA ENDPOINTS (Robots, Sitemap, Manifest)
// ----------------------------------------------------
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send(`User-agent: *\nAllow: /\nSitemap: https://${req.headers.host || "kadyar24.ir"}/sitemap.xml`);
});

app.get("/sitemap.xml", (req, res) => {
  res.type("application/xml");
  try {
    const brands = ["ایران رادیاتور", "بوتان", "ال‌جی", "سامسونگ", "اسنوا"];
    const categories = ["پکیج", "کولر گازی", "ماشین لباسشویی", "ماشین ظرفشویی", "یخچال"];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    xml += `  <url><loc>https://${req.headers.host || "kadyar24.ir"}/</loc><priority>1.0</priority><changefreq>daily</changefreq></url>\n`;

    brands.forEach((brand: string) => {
      categories.forEach((cat: string) => {
        const encodedBrand = encodeURIComponent(brand);
        const encodedCat = encodeURIComponent(cat);
        xml += `  <url><loc>https://${req.headers.host || "kadyar24.ir"}/?brand=${encodedBrand}&amp;category=${encodedCat}</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>\n`;
      });
    });

    xml += `</urlset>`;
    res.send(xml);
  } catch (err) {
    res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://kadyar24.ir/</loc></url></urlset>`);
  }
});

app.get("/manifest.json", (req, res) => {
  res.json({
    name: "سامانه هوشمند کدیار۲۴",
    short_name: "کدیار۲۴",
    description: "بزرگترین مرجع عیب‌یابی و اعزام تکنسین لوازم خانگی کشور",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%234f46e5'><rect width='512' height='512' rx='100'/><path d='M150 150h212v212H150z' fill='white'/></svg>",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  });
});

// Directories setup
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const BACKUPS_DIR = path.join(process.cwd(), "public", "uploads", "backups");
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

app.use("/uploads", express.static(UPLOADS_DIR));

const PORT = 3000;

// Mount Route Modules
app.use("/api/auth", authRouter);
app.use("/api", paymentRouter);
app.use("/api", walletRouter);
app.use("/api/repairs", repairsRouter);
app.use("/api/technician/orders", repairsRouter); // Alias for technician orders
app.use("/api/orders", ordersRouter);
app.use("/api", storeRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/error-codes", errorCodesRouter);
app.use("/api/problems", problemsRouter);
app.use("/api/gemini", geminiRouter);
app.use("/api/sms", smsRouter);
app.use("/api/admin", adminRouter);
app.use("/api", adminRouter);
app.use("/api/server-backups", backupsRouter);
app.use("/api", uploadRouter);
app.use("/api", syncRouter);

// Serve static assets OR use Vite middleware
async function setupServer() {
  await checkDbConnection();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupServer();
