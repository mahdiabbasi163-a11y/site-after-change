import { getDbPool, isMySqlOffline, setMySqlOffline } from "../db/db";
import { logger } from "../utils/logger";

export interface UsageCounter {
  id: string;
  user_id: string;
  feature: string;
  usage_count: number;
  period_start: string;
  period_end?: string;
  created_at: string;
  updated_at: string;
}

const memoryCounters = new Map<string, number>();

export class UsageCounterRepository {
  static async checkAndIncrement(
    userId: string,
    feature: string,
    limit: number = 10
  ): Promise<{ allowed: boolean; count: number; limit: number }> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const counterId = `uc_${userId}_${feature}_${todayStr}`;

    if (isMySqlOffline) {
      const current = memoryCounters.get(counterId) || 0;
      if (current >= limit) {
        return { allowed: false, count: current, limit };
      }
      const next = current + 1;
      memoryCounters.set(counterId, next);
      return { allowed: true, count: next, limit };
    }

    try {
      const pool = getDbPool();

      const [rows]: any = await pool.query(
        "SELECT * FROM usage_counters WHERE id = ?",
        [counterId]
      );

      if (rows.length === 0) {
        await pool.query(
          "INSERT INTO usage_counters (id, user_id, feature, usage_count, period_start) VALUES (?, ?, ?, 1, NOW())",
          [counterId, userId, feature]
        );
        return { allowed: true, count: 1, limit };
      }

      const currentCount = rows[0].usage_count;
      if (currentCount >= limit) {
        return { allowed: false, count: currentCount, limit };
      }

      await pool.query(
        "UPDATE usage_counters SET usage_count = usage_count + 1 WHERE id = ?",
        [counterId]
      );

      return { allowed: true, count: currentCount + 1, limit };
    } catch (err: any) {
      setMySqlOffline(true);
      logger.warn({ userId, feature, err: err.message }, "MySQL error in UsageCounter, switching to offline mode");

      const current = memoryCounters.get(counterId) || 0;
      if (current >= limit) {
        return { allowed: false, count: current, limit };
      }
      const next = current + 1;
      memoryCounters.set(counterId, next);
      return { allowed: true, count: next, limit };
    }
  }

  static async getUsage(userId: string, feature: string): Promise<number> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const counterId = `uc_${userId}_${feature}_${todayStr}`;
    if (isMySqlOffline) {
      return memoryCounters.get(counterId) || 0;
    }
    try {
      const pool = getDbPool();
      const [rows]: any = await pool.query(
        "SELECT usage_count FROM usage_counters WHERE id = ?",
        [counterId]
      );
      if (rows.length > 0) {
        return rows[0].usage_count;
      }
    } catch (err: any) {
      setMySqlOffline(true);
      logger.warn({ err: err.message, userId, feature }, "Error in UsageCounterRepository.getUsage");
    }
    return memoryCounters.get(counterId) || 0;
  }
}
