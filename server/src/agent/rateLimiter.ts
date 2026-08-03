// sam LINE Agent — Rate Limiter (Redis fixed-window)
//
// 每 userId 獨立計數：固定 60 秒視窗內最多 N 個請求
// 使用 Redis INCR + EXPIRE 原子操作（fixed window，不是 token bucket）

import Redis from 'ioredis';

export interface RateLimitConfig {
  windowSec: number;
  maxRequests: number;
  keyPrefix: string;
}

export const DefaultRateLimitConfig: RateLimitConfig = {
  windowSec: 60,
  maxRequests: 30,
  keyPrefix: 'sam:ratelimit:',
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  count: number;
}

let _client: Redis | null = null;

function getClient(): Redis {
  if (_client) return _client;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379/0';
  _client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  _client.on('error', (err) => {
    console.error('[rateLimiter] Redis error:', err.message);
  });
  return _client;
}

export function resetRateLimiterClient(): void {
  if (_client) {
    _client.quit().catch(() => {});
    _client = null;
  }
}

export class RateLimiter {
  private readonly config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DefaultRateLimitConfig, ...config };
  }

  async check(userId: string): Promise<RateLimitResult> {
    const client = getClient();
    const key = `${this.config.keyPrefix}${userId}`;
    const max = this.config.maxRequests;

    try {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, this.config.windowSec);
      }
      const ttl = await client.ttl(key);
      const retryAfterSec = ttl > 0 ? ttl : this.config.windowSec;

      if (count > max) {
        return { allowed: false, remaining: 0, retryAfterSec, count };
      }
      return {
        allowed: true,
        remaining: Math.max(0, max - count),
        retryAfterSec: 0,
        count,
      };
    } catch (e) {
      console.error('[rateLimiter] check failed:', e instanceof Error ? e.message : String(e));
      return { allowed: true, remaining: max, retryAfterSec: 0, count: 0 };
    }
  }

  async reset(userId: string): Promise<void> {
    const client = getClient();
    await client.del(`${this.config.keyPrefix}${userId}`);
  }
}

let _limiter: RateLimiter | null = null;

export function getRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  if (!_limiter) _limiter = new RateLimiter(config);
  return _limiter;
}

export function resetRateLimiter(): void {
  _limiter = null;
}