import { getDbPool, isMySqlOffline, setMySqlOffline } from "../db/db";

const memorySpareParts: any[] = [];

export const SparePartRepository = {
  async findAll(): Promise<any[]> {
    if (isMySqlOffline) return [...memorySpareParts];
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM spare_parts ORDER BY created_at DESC");
      return rows as any[];
    } catch (err: any) {
      setMySqlOffline(true);
      return [...memorySpareParts];
    }
  },
  async findById(id: string): Promise<any | null> {
    if (isMySqlOffline) {
      return memorySpareParts.find(p => String(p.id) === String(id)) || null;
    }
    try {
      const pool = getDbPool();
      const [rows] = await pool.query("SELECT * FROM spare_parts WHERE id = ?", [id]);
      const arr = rows as any[];
      return arr.length > 0 ? arr[0] : null;
    } catch (err: any) {
      setMySqlOffline(true);
      return memorySpareParts.find(p => String(p.id) === String(id)) || null;
    }
  },
  async create(partData: any): Promise<any> {
    const id = partData.id || `part_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const title = partData.title || partData.name || "";
    const category = partData.category || "";
    const brand = partData.brand || "";
    const model = partData.model || "";
    const price = partData.price || 0;
    const stock = partData.stock || 0;
    const imageUrl = partData.image_url || partData.image || "";
    const description = partData.description || "";

    const pool = getDbPool();
    await pool.query(
      `INSERT INTO spare_parts (id, name, title, category, brand, model, price, stock, image_url, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, title, category, brand, model, price, stock, imageUrl, description]
    );

    return SparePartRepository.findById(id);
  },
  async update(id: string, updates: any): Promise<any | null> {
    const pool = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined || updates.name !== undefined) {
      const val = updates.title ?? updates.name;
      fields.push("name = ?, title = ?");
      values.push(val, val);
    }
    if (updates.category !== undefined) { fields.push("category = ?"); values.push(updates.category); }
    if (updates.brand !== undefined) { fields.push("brand = ?"); values.push(updates.brand); }
    if (updates.model !== undefined) { fields.push("model = ?"); values.push(updates.model); }
    if (updates.price !== undefined) { fields.push("price = ?"); values.push(updates.price); }
    if (updates.stock !== undefined) { fields.push("stock = ?"); values.push(updates.stock); }
    if (updates.image_url !== undefined || updates.image !== undefined) {
      fields.push("image_url = ?");
      values.push(updates.image_url ?? updates.image);
    }
    if (updates.description !== undefined) { fields.push("description = ?"); values.push(updates.description); }

    if (fields.length === 0) return SparePartRepository.findById(id);

    values.push(id);
    await pool.query(`UPDATE spare_parts SET ${fields.join(", ")} WHERE id = ?`, values);
    return SparePartRepository.findById(id);
  },
  async deleteById(id: string): Promise<boolean> {
    const pool = getDbPool();
    const [result]: any = await pool.query("DELETE FROM spare_parts WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
};
