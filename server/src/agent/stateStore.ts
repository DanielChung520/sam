// sam LINE Agent — Redis-backed Conversation state store
//
// 設計原則：
//   - Conversation 是 short-lived 對話狀態，TTL 由 Redis 原生處理
//   - 長期歷史另存 ArangoDB（不在此模組職責）
//   - Key prefix 統一 `sam:conv:` 避免與其他服務衝突
//   - Singleton client（lazy init），避免每個請求都新建連線

import Redis from 'ioredis';
import {
  type Conversation,
  type ConversationConfig,
  DefaultConversationConfig,
} from './types.js';
import { AgentError, toAgentError } from './errors.js';

let _client: Redis | null = null;

function getClient(): Redis {
  if (_client) return _client;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379/0';
  _client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  _client.on('error', (err) => {
    console.error('[stateStore] Redis error:', err.message);
  });
  return _client;
}

function conversationKey(id: string, channelId: string, prefix: string): string {
  return `${prefix}${channelId}:${id}`;
}

function userIndexKey(userId: string, channelId: string, prefix: string): string {
  return `${prefix}${channelId}:user:${userId}`;
}

function parseConversation(raw: string | null): Conversation | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Conversation;
  } catch {
    return null;
  }
}

async function assertExists(id: string, channelId: string, prefix: string): Promise<void> {
  const exists = await getClient().exists(conversationKey(id, channelId, prefix));
  if (!exists) {
    throw new AgentError('STATE_CONVERSATION_NOT_FOUND', `conversation ${id} not found in channel ${channelId}`, {
      context: { conversationId: id, channelId },
    });
  }
}

export interface StateStoreOptions {
  config?: Partial<ConversationConfig>;
}

export class ConversationStore {
  private readonly config: ConversationConfig;

  constructor(options: StateStoreOptions = {}) {
    this.config = { ...DefaultConversationConfig, ...options.config };
  }

  async create(conv: Conversation): Promise<Conversation> {
    try {
      const key = conversationKey(conv.id, conv.channelId, this.config.keyPrefix);
      const userKey = userIndexKey(conv.userId, conv.channelId, this.config.keyPrefix);
      const ttl = Math.max(
        1,
        Math.floor((conv.expiresAt - Date.now()) / 1000),
      );

      const pipeline = getClient().pipeline();
      pipeline.set(key, JSON.stringify(conv), 'EX', ttl);
      pipeline.sadd(userKey, conv.id);
      pipeline.expire(userKey, ttl);
      await pipeline.exec();

      return conv;
    } catch (e) {
      throw toAgentError(e, 'REDIS_OPERATION_ERROR');
    }
  }

  async get(id: string, channelId: string): Promise<Conversation | null> {
    try {
      const raw = await getClient().get(conversationKey(id, channelId, this.config.keyPrefix));
      const conv = parseConversation(raw);
      if (conv && conv.channelId !== channelId) {
        return null;
      }
      return conv;
    } catch (e) {
      throw toAgentError(e, 'REDIS_OPERATION_ERROR');
    }
  }

  async getOrThrow(id: string, channelId: string): Promise<Conversation> {
    const conv = await this.get(id, channelId);
    if (!conv) {
      throw new AgentError('STATE_CONVERSATION_NOT_FOUND', `conversation ${id} not found in channel ${channelId}`, {
        context: { conversationId: id, channelId },
      });
    }
    return conv;
  }

  async update(id: string, channelId: string, patch: Partial<Conversation>): Promise<Conversation> {
    try {
      const key = conversationKey(id, channelId, this.config.keyPrefix);
      const raw = await getClient().get(key);
      const existing = parseConversation(raw);
      if (!existing || existing.channelId !== channelId) {
        throw new AgentError('STATE_CONVERSATION_NOT_FOUND', `conversation ${id} not found in channel ${channelId}`, {
          context: { conversationId: id, channelId },
        });
      }

      const merged: Conversation = {
        ...existing,
        ...patch,
        id: existing.id,
        userId: existing.userId,
        channelId: existing.channelId,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      };

      const ttl = await getClient().ttl(key);
      if (ttl <= 0) {
        const newTtl = Math.max(
          1,
          Math.floor((merged.expiresAt - Date.now()) / 1000),
        );
        await getClient().set(key, JSON.stringify(merged), 'EX', newTtl);
      } else {
        await getClient().set(key, JSON.stringify(merged), 'KEEPTTL');
      }
      return merged;
    } catch (e) {
      if (e instanceof AgentError) throw e;
      throw toAgentError(e, 'REDIS_OPERATION_ERROR');
    }
  }

  async touch(id: string, channelId: string): Promise<Conversation> {
    try {
      const key = conversationKey(id, channelId, this.config.keyPrefix);
      const ttl = await getClient().ttl(key);
      if (ttl <= 0) {
        await assertExists(id, channelId, this.config.keyPrefix);
      }
      const existing = await this.getOrThrow(id, channelId);
      const refreshed: Conversation = {
        ...existing,
        updatedAt: Date.now(),
        expiresAt: Date.now() + this.config.ttlSeconds * 1000,
      };
      await getClient().set(key, JSON.stringify(refreshed), 'EX', this.config.ttlSeconds);
      return refreshed;
    } catch (e) {
      if (e instanceof AgentError) throw e;
      throw toAgentError(e, 'REDIS_OPERATION_ERROR');
    }
  }

  async delete(id: string, channelId: string): Promise<boolean> {
    try {
      const key = conversationKey(id, channelId, this.config.keyPrefix);
      const raw = await getClient().get(key);
      const existing = parseConversation(raw);
      const deleted = await getClient().del(key);
      if (existing) {
        await getClient().srem(userIndexKey(existing.userId, existing.channelId, this.config.keyPrefix), id);
      }
      return deleted > 0;
    } catch (e) {
      throw toAgentError(e, 'REDIS_OPERATION_ERROR');
    }
  }

  async listByUser(userId: string, channelId: string): Promise<Conversation[]> {
    try {
      const userKey = userIndexKey(userId, channelId, this.config.keyPrefix);
      const ids = await getClient().smembers(userKey);
      if (ids.length === 0) return [];
      const keys = ids.map((id) => conversationKey(id, channelId, this.config.keyPrefix));
      const raws = await getClient().mget(...keys);
      const out: Conversation[] = [];
      for (const raw of raws) {
        const conv = parseConversation(raw);
        if (conv && conv.channelId === channelId) out.push(conv);
      }
      return out;
    } catch (e) {
      throw toAgentError(e, 'REDIS_OPERATION_ERROR');
    }
  }

  async ping(): Promise<boolean> {
    try {
      const reply = await getClient().ping();
      return reply === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (_client) {
      await _client.quit();
      _client = null;
    }
  }
}

let _store: ConversationStore | null = null;

export function getConversationStore(options?: StateStoreOptions): ConversationStore {
  if (!_store) {
    _store = new ConversationStore(options);
  }
  return _store;
}