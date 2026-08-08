import { getDbPool, isMySqlOffline, parseJsonColumn, setMySqlOffline } from "../db/db";
import { logger } from "../utils/logger";

let inMemoryProblems: any[] = [
  {
    id: "prob_1",
    title: "سرد نکردن یا عدم برودت کافی یخچال و فریزرهای خنک‌کننده",
    category: "یخچال و فریزر",
    brand: "عمومی / تمام برندها",
    model: "انواع مدل‌های نوفراست و معمولی",
    symptoms: ["گرم شدن فضای کابین یخچال", "ذوب شدن یخ در فریزر", "کارکرد یکسره کمپرسور"],
    causes: ["کثیفی کندانسور", "خرابی فن یا سنسور دیفراست", "نشتی گاز مبرد", "خرابی لاستیک دور درب"],
    solutions: ["تمیزکاری کندانسور پشت دستگاه", "تست مقاومت سنسور دیفراست", "بررسی نشتی و شارژ گاز"],
    related_parts: ["سنسور دیفراست", "موتور فن فریزر", "ترموستات"],
    severity: "high"
  },
  {
    id: "prob_2",
    title: "عدم تخلیه آب در ماشین لباسشویی",
    category: "ماشین لباسشویی",
    brand: "عمومی / تمام برندها",
    model: "لباسشویی اتوماتیک درب از جلو",
    symptoms: ["باقی ماندن آب در دیگ پس از شستشو", "توقف برنامه شستشو در مرحله تخلیه", "صدا دادن پمپ تخلیه"],
    causes: ["مسدود شدن فیلتر پمپ تخلیه", "گیر کردن جسم خارجی در پروانه پمپ", "خرابی پمپ تخلیه یا تاخوردگی شلنگ"],
    solutions: ["باز کردن فیلتر پایین لباسشویی و پاکسازی پسماندها", "بررسی مسیر شلنگ خروجی", "تعویض پمپ تخلیه"],
    related_parts: ["پمپ تخلیه", "فیلتر تخلیه", "میکروسوئیچ"],
    severity: "medium"
  }
];

function formatProblemRow(row: any): any {
  if (!row) return null;
  const symptoms = Array.isArray(row.symptoms) ? row.symptoms : parseJsonColumn(row.symptoms) || [];
  const causes = Array.isArray(row.causes) ? row.causes : parseJsonColumn(row.causes) || [];
  const solutions = Array.isArray(row.solutions) ? row.solutions : parseJsonColumn(row.solutions) || [];
  const relatedParts = Array.isArray(row.related_parts) ? row.related_parts : parseJsonColumn(row.related_parts) || [];

  return {
    id: row.id,
    title: row.title || "",
    category: row.category || "",
    brand: row.brand || "",
    model: row.model || "",
    symptoms: Array.isArray(symptoms) ? symptoms : (symptoms ? [String(symptoms)] : []),
    causes: Array.isArray(causes) ? causes : (causes ? [String(causes)] : []),
    solutions: Array.isArray(solutions) ? solutions : (solutions ? [String(solutions)] : []),
    relatedParts: Array.isArray(relatedParts) ? relatedParts : (relatedParts ? [String(relatedParts)] : []),
    severity: row.severity || row.hazardLevel || "medium"
  };
}

export const ProblemRepository = {
  async findAll(): Promise<any[]> {
    if (isMySqlOffline) {
      return inMemoryProblems;
    }
    try {
      const pool = getDbPool();
      const [rows]: any = await pool.query("SELECT * FROM problems ORDER BY created_at DESC");
      if (!rows || rows.length === 0) {
        return inMemoryProblems;
      }
      return rows.map(formatProblemRow);
    } catch (err: any) {
      logger.warn({ err: err.message }, "ProblemRepository.findAll DB error");
      setMySqlOffline(true);
      return inMemoryProblems;
    }
  },

  async findById(id: string): Promise<any | null> {
    if (isMySqlOffline) {
      return inMemoryProblems.find(p => String(p.id) === String(id)) || null;
    }
    try {
      const pool = getDbPool();
      const [rows]: any = await pool.query("SELECT * FROM problems WHERE id = ?", [id]);
      if (rows && rows.length > 0) {
        return formatProblemRow(rows[0]);
      }
      return inMemoryProblems.find(p => String(p.id) === String(id)) || null;
    } catch (err: any) {
      logger.warn({ err: err.message }, "ProblemRepository.findById DB error");
      setMySqlOffline(true);
      return inMemoryProblems.find(p => String(p.id) === String(id)) || null;
    }
  },

  async create(data: any): Promise<any> {
    const id = data.id || `prob_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const title = String(data.title || "").trim();
    const category = String(data.category || "").trim();
    const brand = String(data.brand || "").trim();
    const model = String(data.model || "").trim();
    const severity = String(data.severity || data.hazardLevel || "medium");

    const symptoms = Array.isArray(data.symptoms) ? JSON.stringify(data.symptoms) : (typeof data.symptoms === "string" ? JSON.stringify(data.symptoms.split("\n").filter(Boolean)) : JSON.stringify([]));
    const causes = Array.isArray(data.causes) ? JSON.stringify(data.causes) : (typeof data.causes === "string" ? JSON.stringify(data.causes.split("\n").filter(Boolean)) : JSON.stringify([]));
    const solutions = Array.isArray(data.solutions) ? JSON.stringify(data.solutions) : (typeof data.solutions === "string" ? JSON.stringify(data.solutions.split("\n").filter(Boolean)) : JSON.stringify([]));
    const relatedParts = Array.isArray(data.relatedParts) ? JSON.stringify(data.relatedParts) : (typeof data.relatedParts === "string" ? JSON.stringify(data.relatedParts.split("\n").filter(Boolean)) : JSON.stringify([]));

    const newItem = {
      id, title, category, brand, model, severity,
      symptoms: parseJsonColumn(symptoms),
      causes: parseJsonColumn(causes),
      solutions: parseJsonColumn(solutions),
      relatedParts: parseJsonColumn(relatedParts)
    };

    const pool = getDbPool();
    await pool.query(
      `INSERT INTO problems (id, title, category, brand, model, symptoms, causes, solutions, related_parts, severity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, category, brand, model, symptoms, causes, solutions, relatedParts, severity]
    );
    return ProblemRepository.findById(id);
  },

  async update(id: string, updates: any): Promise<any | null> {
    const pool = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push("title = ?"); values.push(String(updates.title).trim()); }
    if (updates.category !== undefined) { fields.push("category = ?"); values.push(String(updates.category).trim()); }
    if (updates.brand !== undefined) { fields.push("brand = ?"); values.push(String(updates.brand).trim()); }
    if (updates.model !== undefined) { fields.push("model = ?"); values.push(String(updates.model).trim()); }
    if (updates.severity !== undefined || updates.hazardLevel !== undefined) {
      fields.push("severity = ?");
      values.push(String(updates.severity || updates.hazardLevel || "medium"));
    }

    if (updates.symptoms !== undefined) {
      fields.push("symptoms = ?");
      values.push(Array.isArray(updates.symptoms) ? JSON.stringify(updates.symptoms) : (typeof updates.symptoms === "string" ? JSON.stringify(updates.symptoms.split("\n").filter(Boolean)) : JSON.stringify([])));
    }
    if (updates.causes !== undefined) {
      fields.push("causes = ?");
      values.push(Array.isArray(updates.causes) ? JSON.stringify(updates.causes) : (typeof updates.causes === "string" ? JSON.stringify(updates.causes.split("\n").filter(Boolean)) : JSON.stringify([])));
    }
    if (updates.solutions !== undefined) {
      fields.push("solutions = ?");
      values.push(Array.isArray(updates.solutions) ? JSON.stringify(updates.solutions) : (typeof updates.solutions === "string" ? JSON.stringify(updates.solutions.split("\n").filter(Boolean)) : JSON.stringify([])));
    }
    if (updates.relatedParts !== undefined || updates.related_parts !== undefined) {
      fields.push("related_parts = ?");
      const rel = updates.relatedParts !== undefined ? updates.relatedParts : updates.related_parts;
      values.push(Array.isArray(rel) ? JSON.stringify(rel) : (typeof rel === "string" ? JSON.stringify(rel.split("\n").filter(Boolean)) : JSON.stringify([])));
    }

    if (fields.length === 0) return ProblemRepository.findById(id);

    values.push(id);
    await pool.query(`UPDATE problems SET ${fields.join(", ")} WHERE id = ?`, values);
    return ProblemRepository.findById(id);
  },

  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM problems WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};
