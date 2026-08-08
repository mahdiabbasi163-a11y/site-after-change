import fs from "fs";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import express from "express";

export const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
export const BACKUPS_DIR = path.join(process.cwd(), "public", "uploads", "backups");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export let isMySqlOffline = false;
export function setMySqlOffline(val: boolean) {
  isMySqlOffline = val;
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (isMySqlOffline) return;
  try {
    const p = getDbPool();

    // 1. error_codes table
    await p.query(`
      CREATE TABLE IF NOT EXISTS error_codes (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        category VARCHAR(100) DEFAULT '',
        brand VARCHAR(100) DEFAULT '',
        model VARCHAR(100) DEFAULT '',
        title TEXT,
        description TEXT,
        causes JSON,
        steps JSON,
        precautions JSON,
        hazard_level VARCHAR(20) DEFAULT 'medium',
        solution TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. problems table (General Problems / Symptoms)
    await p.query(`
      CREATE TABLE IF NOT EXISTS problems (
        id VARCHAR(100) PRIMARY KEY,
        title TEXT NOT NULL,
        category VARCHAR(100) DEFAULT '',
        brand VARCHAR(100) DEFAULT '',
        model VARCHAR(100) DEFAULT '',
        symptoms JSON,
        causes JSON,
        solutions JSON,
        related_parts JSON,
        severity VARCHAR(20) DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. users table
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        full_name VARCHAR(100) DEFAULT '',
        role VARCHAR(20) DEFAULT 'client',
        is_super_admin TINYINT(1) DEFAULT 0,
        city VARCHAR(50) DEFAULT '',
        address TEXT,
        password_hash VARCHAR(255) DEFAULT '',
        wallet_balance DECIMAL(15,2) DEFAULT 0.00,
        referral_code VARCHAR(100) DEFAULT '',
        must_change_password TINYINT(1) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. technicians table
    await p.query(`
      CREATE TABLE IF NOT EXISTS technicians (
        id VARCHAR(100) PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) DEFAULT '',
        full_name VARCHAR(100) DEFAULT '',
        national_id VARCHAR(50) DEFAULT '',
        specialty JSON,
        specialties JSON,
        rating DECIMAL(3,2) DEFAULT 5.0,
        completed_orders INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        city VARCHAR(50) DEFAULT 'تهران',
        avatar_url TEXT,
        wallet_balance DECIMAL(15,2) DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. payments table
    await p.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        payment_type VARCHAR(50) NOT NULL,
        gateway VARCHAR(50) DEFAULT 'card_to_card',
        status VARCHAR(20) DEFAULT 'pending',
        receipt_img TEXT,
        ref_code VARCHAR(100) DEFAULT '',
        card_number VARCHAR(50) DEFAULT '',
        tracking_code VARCHAR(100) DEFAULT '',
        admin_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. orders table
    await p.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        customer_name VARCHAR(100) DEFAULT '',
        customer_phone VARCHAR(20) DEFAULT '',
        user_id VARCHAR(100),
        city VARCHAR(50) DEFAULT '',
        address TEXT,
        category VARCHAR(100) DEFAULT '',
        brand VARCHAR(100) DEFAULT '',
        model VARCHAR(100) DEFAULT '',
        error_code VARCHAR(50) DEFAULT '',
        status VARCHAR(50) DEFAULT 'registered',
        assigned_tech_id VARCHAR(100),
        price DECIMAL(15,2) DEFAULT 0,
        payment_id VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. part_orders table
    await p.query(`
      CREATE TABLE IF NOT EXISTS part_orders (
        id VARCHAR(100) PRIMARY KEY,
        order_number VARCHAR(50),
        user_id VARCHAR(100),
        buyer_name VARCHAR(100) DEFAULT '',
        buyer_phone VARCHAR(20) DEFAULT '',
        address TEXT,
        total_amount DECIMAL(15,2) NOT NULL,
        payment_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        items JSON,
        shipping_tracking_code VARCHAR(100) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. subscriptions table
    await p.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        plan_type VARCHAR(50) DEFAULT 'عضویت ویژه',
        payment_id VARCHAR(100),
        start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_date DATETIME NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. spare_parts table
    await p.query(`
      CREATE TABLE IF NOT EXISTS spare_parts (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        title VARCHAR(150) DEFAULT '',
        category VARCHAR(100) DEFAULT '',
        brand VARCHAR(100) DEFAULT '',
        model VARCHAR(100) DEFAULT '',
        price DECIMAL(15,2) DEFAULT 0,
        stock INT DEFAULT 0,
        image_url TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. sessions table
    await p.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        token TEXT NOT NULL,
        refresh_token TEXT,
        user_agent TEXT,
        ip VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. settings table
    await p.query(`
      CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. activity_logs
    await p.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100),
        action VARCHAR(100),
        ip VARCHAR(50),
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. usage_counter
    await p.query(`
      CREATE TABLE IF NOT EXISTS usage_counter (
        user_id VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        usage_date DATE NOT NULL,
        count INT DEFAULT 1,
        PRIMARY KEY (user_id, action, usage_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Safely ensure missing columns exist on existing tables
    const alters = [
      `ALTER TABLE users ADD COLUMN wallet_balance DECIMAL(15,2) DEFAULT 0.00`,
      `ALTER TABLE users ADD COLUMN referral_code VARCHAR(100) DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) DEFAULT 0`,
      `ALTER TABLE technicians ADD COLUMN full_name VARCHAR(100) DEFAULT ''`,
      `ALTER TABLE technicians ADD COLUMN national_id VARCHAR(50) DEFAULT ''`,
      `ALTER TABLE technicians ADD COLUMN specialties JSON`,
      `ALTER TABLE technicians ADD COLUMN avatar_url TEXT`,
      `ALTER TABLE technicians ADD COLUMN wallet_balance DECIMAL(15,2) DEFAULT 0.00`,
      `ALTER TABLE spare_parts ADD COLUMN title VARCHAR(150) DEFAULT ''`
    ];

    for (const sql of alters) {
      try {
        await p.query(sql);
      } catch (e) {
        // Ignored if column exists
      }
    }

  } catch (err: any) {
    console.warn("[ensureDatabaseSchema] Table check/creation note:", err.message);
  }
}

export async function checkDbConnection(): Promise<boolean> {
  const rawHost = process.env.DB_HOST;
  const dbHost = (rawHost && rawHost !== "localhost" && rawHost !== "127.0.0.1") ? rawHost : "89.39.208.237";
  try {
    const p = getDbPool();
    const conn: any = await Promise.race([
      p.getConnection(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB Connection timeout")), 10000)
      )
    ]);
    conn.release();
    setMySqlOffline(false);
    await ensureDatabaseSchema();
    return true;
  } catch (err: any) {
    setMySqlOffline(true);
    console.warn(`[DB Connection] Connection check to ${dbHost} status: ${err.message}. Operating in offline/JSON mode.`);
    return false;
  }
}

let pool: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool {
  if (!pool) {
    const rawHost = process.env.DB_HOST;
    const dbHost = (rawHost && rawHost !== "localhost" && rawHost !== "127.0.0.1") ? rawHost : "89.39.208.237";
    const dbUser = process.env.DB_USER || "bvrfefgr_kodyar24_test_user";
    const dbPassword = process.env.DB_PASSWORD || process.env.DB_PASS || "Kdyr24Test8xQm5Rw2";
    const dbName = process.env.DB_NAME || "bvrfefgr_kodyar24_test";
    const dbPort = parseInt(process.env.DB_PORT || "3306");

    pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      port: dbPort,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000
    });
  }
  return pool;
}

export function parseJsonColumn(val: any): any {
  if (!val) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

export function toSqlDatetime(dateStr: any): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace("T", " ");
  } catch {
    return null;
  }
}

export function hashPassword(plainText: string): string {
  if (!plainText) return "";
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!password || !hash) return false;

  // 1. Direct plaintext match
  if (password === hash) return true;

  // 2. Bcrypt match ($2a$, $2b$, $2y$)
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    try {
      return bcrypt.compareSync(password, hash);
    } catch {
      return false;
    }
  }

  // 3. MD5 hash check (32 hex characters)
  if (hash.length === 32 && /^[a-fA-F0-9]{32}$/.test(hash)) {
    try {
      const md5 = crypto.createHash("md5").update(password).digest("hex");
      if (md5.toLowerCase() === hash.toLowerCase()) return true;
    } catch {}
  }

  // 4. SHA256 hash check (64 hex characters)
  if (hash.length === 64 && /^[a-fA-F0-9]{64}$/.test(hash)) {
    try {
      const sha256 = crypto.createHash("sha256").update(password).digest("hex");
      if (sha256.toLowerCase() === hash.toLowerCase()) return true;
    } catch {}
  }

  return false;
}

export async function getCurrentUserAsync(req: express.Request): Promise<any | null> {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/session_user_id=([^; ]+)/);
  const tokenMatch = cookieHeader.match(/access_token=([^; ]+)/);
  let sessionUserId = match ? match[1] : null;
  let accessToken = tokenMatch ? tokenMatch[1] : null;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    accessToken = req.headers.authorization.split(" ")[1];
  }

  if (!sessionUserId && req.headers["x-session-token"]) {
    sessionUserId = Array.isArray(req.headers["x-session-token"])
      ? req.headers["x-session-token"][0]
      : (req.headers["x-session-token"] as string);
  }

  if (sessionUserId === "admin") {
    return {
      id: "admin",
      phone: "09120947304",
      full_name: "مدیریت عالی کدیار۲۴",
      role: "admin",
      is_super_admin: true,
      city: "تهران"
    };
  }

  if (isMySqlOffline) {
    return null;
  }

  try {
    const p = getDbPool();

    // 1. Check token in sessions table if present
    if (accessToken) {
      const [sessRows]: any = await p.query(
        "SELECT * FROM sessions WHERE (token = ? OR refresh_token = ?) AND expires_at > NOW()",
        [accessToken, accessToken]
      );
      if (sessRows.length > 0) {
        sessionUserId = sessRows[0].user_id;
      }
    }

    if (!sessionUserId) return null;

    const [userRows]: any = await p.query("SELECT * FROM users WHERE id = ? OR phone = ?", [sessionUserId, sessionUserId]);
    if (userRows.length > 0) {
      return userRows[0];
    }

    const [techRows]: any = await p.query("SELECT * FROM technicians WHERE id = ? OR phone = ?", [sessionUserId, sessionUserId]);
    if (techRows.length > 0) {
      const tech = techRows[0];
      return {
        id: tech.id,
        phone: tech.phone,
        full_name: tech.full_name || tech.name,
        role: "technician",
        city: tech.city || tech.activeLocation || "تهران",
        isVerified: tech.status === "active"
      };
    }
  } catch (err: any) {
    setMySqlOffline(true);
    console.warn("[getCurrentUserAsync] Error fetching user:", err.message);
  }

  return null;
}


export function getCurrentUser(req: express.Request, db?: any): any {
  // Synchronous fallback wrapper returning null if called synchronously, or admin
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/session_user_id=([^; ]+)/);
  let sessionUserId = match ? match[1] : null;

  if (!sessionUserId && req.headers["x-session-token"]) {
    sessionUserId = Array.isArray(req.headers["x-session-token"])
      ? req.headers["x-session-token"][0]
      : (req.headers["x-session-token"] as string);
  }

  if (sessionUserId === "admin") {
    return {
      id: "admin",
      phone: "09120947304",
      full_name: "مدیریت عالی کدیار۲۴",
      role: "admin",
      is_super_admin: true,
      city: "تهران"
    };
  }

  return null;
}

export function checkMustChangePassword(user: any): boolean {
  if (!user || user.role === "admin") return false;
  return !user.password_hash || user.password_hash.length < 10 || user.password_hash === user.phone;
}

export async function getSubscriptionForUserAsync(userId: string): Promise<any | null> {
  if (isMySqlOffline) return null;
  try {
    const p = getDbPool();
    const [rows]: any = await p.query(
      "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY end_date DESC LIMIT 1",
      [userId]
    );
    if (rows.length > 0) {
      const activeSub = rows[0];
      const endDate = new Date(activeSub.end_date);
      const isPermanent = endDate.getFullYear() >= 2090;
      return {
        plan_name: activeSub.plan_type || "عضویت ویژه",
        expiry_date: activeSub.end_date,
        is_active: true,
        is_permanent: isPermanent,
        days_left: isPermanent ? 99999 : Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      };
    }
  } catch (err: any) {
    console.warn("Error in getSubscriptionForUserAsync:", err.message);
  }
  return null;
}

export async function logActivity(userId: string, action: string, req: express.Request, details: string) {
  try {
    const id = `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const pool = getDbPool();
    if (pool && !isMySqlOffline) {
      await pool.query(
        "INSERT INTO activity_logs (id, user_id, action, ip, details) VALUES (?, ?, ?, ?, ?)",
        [id, userId, action, String(ip).substring(0, 50), details]
      );
    }
  } catch (err: any) {
    console.warn("Error in logActivity:", err.message);
  }
}

export async function reportError(errorMessage: string, stackTrace: string, url: string, userId: string) {
  try {
    const id = `err_log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const pool = getDbPool();
    if (pool && !isMySqlOffline) {
      await pool.query(
        "INSERT INTO error_logs (id, error_message, stack_trace, url, user_id) VALUES (?, ?, ?, ?, ?)",
        [id, errorMessage, stackTrace, url, userId]
      );
    }
  } catch (err: any) {
    console.warn("Error in reportError:", err.message);
  }
}
