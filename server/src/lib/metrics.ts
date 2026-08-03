// Metrics tracker (Redis-backed)
//
// 簡單的 counters + errors list：
//   - sam:metric:messages:YYYY-MM-DD:HH  → 每小時訊息數（24h TTL）
//   - sam:metric:skill:calls:{skillId}   → skill 呼叫次數
//   - sam:metric:errors                 → 最近錯誤 list（保留 50 筆）
//
// 都設計成可丟失（best-effort），不影響主流程。

import Redis from 'ioredis';

let _client: Redis | null = null;

function getClient(): Redis {
  if (_client) return _client;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379/0';
  _client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: false });
  _client.on('error', () => {});
  return _client;
}

function hourKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  const h = date.getUTCHours().toString().padStart(2, '0');
  return `${y}-${m}-${d}:${h}`;
}

function isoHour(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const hh = d.getUTCHours().toString().padStart(2, '0');
  return `${y}-${m}-${dd}T${hh}:00:00Z`;
}

export const Metrics = {
  async incMessage(): Promise<void> {
    try {
      const k = `sam:metric:messages:${hourKey()}`;
      const c = getClient();
      await c.incr(k);
      await c.expire(k, 26 * 3600); // 保留 26 小時（涵蓋 24h 視窗）
    } catch {
      // 忽略，不影響主流程
    }
  },

  async incSkillCall(skillId: string): Promise<void> {
    try {
      const k = `sam:metric:skill:calls:${skillId}`;
      const c = getClient();
      await c.incr(k);
    } catch {
      // ignore
    }
  },

  async pushError(scope: string, message: string, context?: Record<string, unknown>): Promise<void> {
    try {
      const entry = JSON.stringify({
        ts: new Date().toISOString(),
        scope,
        message: message.slice(0, 300),
        context: context ? JSON.stringify(context).slice(0, 200) : undefined,
      });
      const c = getClient();
      await c.lpush('sam:metric:errors', entry);
      await c.ltrim('sam:metric:errors', 0, 49);
    } catch {
      // ignore
    }
  },

  async getMessages24h(): Promise<Array<{ hour: string; count: number }>> {
    try {
      const c = getClient();
      const now = Date.now();
      const out: Array<{ hour: string; count: number }> = [];
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now - i * 3600_000);
        const k = `sam:metric:messages:${hourKey(d)}`;
        const v = await c.get(k);
        out.push({ hour: isoHour(d.getTime()), count: v ? parseInt(v, 10) : 0 });
      }
      return out;
    } catch {
      return [];
    }
  },

  async getTopSkills(limit = 10): Promise<Array<{ skillId: string; calls: number }>> {
    try {
      const c = getClient();
      const keys = await c.keys('sam:metric:skill:calls:*');
      if (keys.length === 0) return [];
      const raws = await c.mget(...keys);
      const items: Array<{ skillId: string; calls: number }> = [];
      for (let i = 0; i < keys.length; i++) {
        const v = raws[i];
        if (!v) continue;
        const skillId = keys[i].replace('sam:metric:skill:calls:', '');
        items.push({ skillId, calls: parseInt(v, 10) });
      }
      items.sort((a, b) => b.calls - a.calls);
      return items.slice(0, limit);
    } catch {
      return [];
    }
  },

  async getRecentErrors(limit = 10): Promise<Array<{ ts: string; scope: string; message: string; context?: string }>> {
    try {
      const c = getClient();
      const raws = await c.lrange('sam:metric:errors', 0, limit - 1);
      return raws.map((r) => {
        try {
          return JSON.parse(r);
        } catch {
          return { ts: '', scope: '?', message: r };
        }
      });
    } catch {
      return [];
    }
  },
};