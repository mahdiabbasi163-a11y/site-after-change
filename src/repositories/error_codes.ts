import { getDbPool, isMySqlOffline, parseJsonColumn, setMySqlOffline } from "../db/db";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

let cachedFallbackCodes: any[] | null = null;

function getFallbackErrorCodes(): any[] {
  if (cachedFallbackCodes) return cachedFallbackCodes;
  try {
    const jsonPath = path.join(process.cwd(), "error_codes_formatted.json");
    const altJsonPath = path.join(process.cwd(), "public", "error_codes.json");
    const targetPath = fs.existsSync(jsonPath) ? jsonPath : altJsonPath;

    if (fs.existsSync(targetPath)) {
      const content = fs.readFileSync(targetPath, "utf8");
      const list = JSON.parse(content);
      cachedFallbackCodes = list.map((item: any, idx: number) => ({
        id: item.id || `json_err_${idx + 1}`,
        code: item.code || "",
        brand: item.brand || "",
        model: item.model || "",
        category: item.category || "",
        title: item.title || item.title_fa || "",
        description: item.description || item.cause || "",
        causes: Array.isArray(item.causes) ? item.causes : (item.cause ? [item.cause] : []),
        steps: Array.isArray(item.steps) ? item.steps : (item.solution ? [item.solution] : []),
        precautions: Array.isArray(item.precautions) ? item.precautions : [],
        hazardLevel: item.hazardLevel || item.hazard_level || "medium",
        solution: item.solution || item.fix || ""
      }));
      return cachedFallbackCodes;
    }
  } catch (err: any) {
    logger.error({ err }, "Failed to load fallback error_codes JSON");
  }
  return [];
}

function formatErrorCodeRow(row: any): any {
  if (!row) return null;
  const causes = Array.isArray(row.causes) ? row.causes : parseJsonColumn(row.causes) || [];
  const steps = Array.isArray(row.steps) ? row.steps : parseJsonColumn(row.steps) || [];
  const precautions = Array.isArray(row.precautions) ? row.precautions : parseJsonColumn(row.precautions) || [];

  return {
    id: row.id,
    code: row.code || "",
    category: row.category || "",
    brand: row.brand || "",
    model: row.model || "",
    title: row.title || "",
    description: row.description || "",
    causes: Array.isArray(causes) ? causes : (causes ? [String(causes)] : []),
    steps: Array.isArray(steps) ? steps : (steps ? [String(steps)] : []),
    precautions: Array.isArray(precautions) ? precautions : (precautions ? [String(precautions)] : []),
    hazardLevel: row.hazard_level || row.hazardLevel || "medium",
    solution: row.solution || (Array.isArray(steps) ? steps.join("\n") : "")
  };
}

export const ErrorCodeRepository = {
  async findAll(): Promise<any[]> {
    if (isMySqlOffline) {
      return getFallbackErrorCodes();
    }
    try {
      const pool = getDbPool();
      const [rows]: any = await pool.query("SELECT * FROM error_codes ORDER BY created_at DESC");
      if (!rows || rows.length === 0) {
        return getFallbackErrorCodes();
      }
      return rows.map(formatErrorCodeRow);
    } catch (err: any) {
      logger.warn({ err: err.message }, "ErrorCodeRepository.findAll DB error, falling back to JSON");
      setMySqlOffline(true);
      return getFallbackErrorCodes();
    }
  },
  async findById(id: string): Promise<any | null> {
    if (isMySqlOffline) {
      const list = getFallbackErrorCodes();
      return list.find((item: any) => String(item.id) === String(id)) || null;
    }
    try {
      const pool = getDbPool();
      const [rows]: any = await pool.query("SELECT * FROM error_codes WHERE id = ?", [id]);
      if (rows && rows.length > 0) {
        return formatErrorCodeRow(rows[0]);
      }
      const list = getFallbackErrorCodes();
      return list.find((item: any) => String(item.id) === String(id)) || null;
    } catch (err: any) {
      logger.warn({ err: err.message }, "ErrorCodeRepository.findById DB error, falling back to JSON");
      setMySqlOffline(true);
      const list = getFallbackErrorCodes();
      return list.find((item: any) => String(item.id) === String(id)) || null;
    }
  },
  async findByCodeBrandModel(code: string, brand: string, model: string): Promise<any | null> {
    if (isMySqlOffline) {
      const list = getFallbackErrorCodes();
      return list.find((item: any) =>
        String(item.code || "").toUpperCase().trim() === String(code || "").toUpperCase().trim() &&
        String(item.brand || "").toLowerCase().trim() === String(brand || "").toLowerCase().trim() &&
        String(item.model || "").toLowerCase().trim() === String(model || "").toLowerCase().trim()
      ) || null;
    }
    try {
      const pool = getDbPool();
      const [rows]: any = await pool.query(
        "SELECT * FROM error_codes WHERE UPPER(TRIM(code)) = UPPER(TRIM(?)) AND LOWER(TRIM(brand)) = LOWER(TRIM(?)) AND LOWER(TRIM(model)) = LOWER(TRIM(?))",
        [code, brand, model]
      );
      if (rows && rows.length > 0) {
        return formatErrorCodeRow(rows[0]);
      }
      const list = getFallbackErrorCodes();
      return list.find((item: any) =>
        String(item.code || "").toUpperCase().trim() === String(code || "").toUpperCase().trim() &&
        String(item.brand || "").toLowerCase().trim() === String(brand || "").toLowerCase().trim()
      ) || null;
    } catch (err: any) {
      logger.warn({ err: err.message }, "ErrorCodeRepository.findByCodeBrandModel DB error");
      setMySqlOffline(true);
      const list = getFallbackErrorCodes();
      return list.find((item: any) =>
        String(item.code || "").toUpperCase().trim() === String(code || "").toUpperCase().trim() &&
        String(item.brand || "").toLowerCase().trim() === String(brand || "").toLowerCase().trim()
      ) || null;
    }
  },
  async create(errData: any): Promise<any> {
    const id = errData.id || `err_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const code = String(errData.code || "").trim();
    const brand = String(errData.brand || "").trim();
    const model = String(errData.model || "").trim();
    const category = String(errData.category || "").trim();
    const title = String(errData.title || errData.title_fa || "").trim();
    const description = String(errData.description || errData.cause || "").trim();

    const causes = Array.isArray(errData.causes) ? JSON.stringify(errData.causes) : (typeof errData.causes === "string" ? JSON.stringify(errData.causes.split("\n").filter(Boolean)) : JSON.stringify([]));
    const steps = Array.isArray(errData.steps) ? JSON.stringify(errData.steps) : (typeof errData.steps === "string" ? JSON.stringify(errData.steps.split("\n").filter(Boolean)) : JSON.stringify([]));
    const precautions = Array.isArray(errData.precautions) ? JSON.stringify(errData.precautions) : (typeof errData.precautions === "string" ? JSON.stringify(errData.precautions.split("\n").filter(Boolean)) : JSON.stringify([]));
    const hazardLevel = String(errData.hazardLevel || errData.hazard_level || "medium");
    const solution = String(errData.solution || "");

    const newItem = {
      id, code, brand, model, category, title, description,
      causes: parseJsonColumn(causes),
      steps: parseJsonColumn(steps),
      precautions: parseJsonColumn(precautions),
      hazardLevel, solution
    };

    const pool = getDbPool();
    await pool.query(
      `INSERT INTO error_codes (id, code, brand, model, category, title, description, causes, steps, precautions, hazard_level, solution)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, code, brand, model, category, title, description, causes, steps, precautions, hazardLevel, solution]
    );
    return ErrorCodeRepository.findById(id);
  },
  async update(id: string, updates: any): Promise<any | null> {
    const pool = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.code !== undefined) { fields.push("code = ?"); values.push(String(updates.code).trim()); }
    if (updates.brand !== undefined) { fields.push("brand = ?"); values.push(String(updates.brand).trim()); }
    if (updates.model !== undefined) { fields.push("model = ?"); values.push(String(updates.model).trim()); }
    if (updates.category !== undefined) { fields.push("category = ?"); values.push(String(updates.category).trim()); }
    if (updates.title !== undefined) { fields.push("title = ?"); values.push(String(updates.title).trim()); }
    if (updates.description !== undefined) { fields.push("description = ?"); values.push(String(updates.description).trim()); }

    if (updates.causes !== undefined) {
      fields.push("causes = ?");
      values.push(Array.isArray(updates.causes) ? JSON.stringify(updates.causes) : (typeof updates.causes === "string" ? JSON.stringify(updates.causes.split("\n").filter(Boolean)) : JSON.stringify([])));
    }
    if (updates.steps !== undefined) {
      fields.push("steps = ?");
      values.push(Array.isArray(updates.steps) ? JSON.stringify(updates.steps) : (typeof updates.steps === "string" ? JSON.stringify(updates.steps.split("\n").filter(Boolean)) : JSON.stringify([])));
    }
    if (updates.precautions !== undefined) {
      fields.push("precautions = ?");
      values.push(Array.isArray(updates.precautions) ? JSON.stringify(updates.precautions) : (typeof updates.precautions === "string" ? JSON.stringify(updates.precautions.split("\n").filter(Boolean)) : JSON.stringify([])));
    }
    if (updates.hazardLevel !== undefined || updates.hazard_level !== undefined) {
      fields.push("hazard_level = ?");
      values.push(String(updates.hazardLevel || updates.hazard_level || "medium"));
    }
    if (updates.solution !== undefined) {
      fields.push("solution = ?");
      values.push(String(updates.solution));
    }

    if (fields.length === 0) return ErrorCodeRepository.findById(id);

    values.push(id);
    await pool.query(`UPDATE error_codes SET ${fields.join(", ")} WHERE id = ?`, values);
    return ErrorCodeRepository.findById(id);
  },
  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM error_codes WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};

