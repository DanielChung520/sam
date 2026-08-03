// LINE Channel repository（ArangoDB）
//
// 每個業務員的 LINE channel 對應一筆文件。
// Lookup key：LINE webhook 的 `destination` 欄位（= bot user ID）。

import { getDb, ensureCollection } from '../data/arango.js';

export interface Channel {
  _key: string;
  channelId: string;
  destination?: string;          // LINE webhook destination（bot user ID），查詢 key
  businessOwnerId: string;
  name: string;
  channelSecret: string;
  accessToken: string;
  enabled: boolean;
  linkedAgentKey: string;          // 綁定的主 Agent _key（預設入口）
  authorizedAgents?: string[];     // 授權的其他 agent _key 列表（多對多）
  permissions?: string[];          // 額外允許的 skill（undefined = 全部允許）
  avatar?: string;                 // 頭像：系統圖示檔名或 dataURL
  pushEnabled?: boolean;           // 是否啟用 push 回覆（LINE 需開 push 權限）
  ackEnabled?: boolean;            // 慢任務是否先回「處理中...」
  ackMessage?: string;             // ack 文案
  concurrencyLimit?: number;       // 此 channel 同時最多幾個 worker
  queuePriority?: number;          // 佇列優先權（越高越先處理）
  createdAt: number;
  updatedAt: number;
}

const COLLECTION = 'channels';

export async function ensureChannelsCollection(): Promise<void> {
  await ensureCollection(COLLECTION);
}

export async function findChannelByDestination(destination: string): Promise<Channel | null> {
  const db = getDb();
  const cursor = await db.query(
    `FOR c IN ${COLLECTION} FILTER c.destination == @dest LIMIT 1 RETURN c`,
    { dest: destination },
  );
  const results = await cursor.all();
  return results[0] as Channel | null;
}

export async function findChannelById(channelId: string): Promise<Channel | null> {
  const db = getDb();
  try {
    const doc = await db.collection(COLLECTION).document(channelId);
    return doc as Channel;
  } catch {
    return null;
  }
}

// 依 LINE Channel ID（channelId 欄位）查詢 — 用於唯一性檢查
export async function findByLineChannelId(lineChannelId: string, excludeKey?: string): Promise<Channel | null> {
  const db = getDb();
  const bind = { lineChannelId };
  const cursor = await db.query(
    `FOR c IN ${COLLECTION} FILTER c.channelId == @lineChannelId ${excludeKey ? 'FILTER c._key != @excludeKey' : ''} LIMIT 1 RETURN c`,
    excludeKey ? { ...bind, excludeKey } : bind,
  );
  const results = (await cursor.all()) as Channel[];
  return results[0] ?? null;
}

export async function listChannelsByOwner(businessOwnerId: string): Promise<Channel[]> {
  const db = getDb();
  const cursor = await db.query(
    `FOR c IN ${COLLECTION} FILTER c.businessOwnerId == @owner RETURN c`,
    { owner: businessOwnerId },
  );
  return (await cursor.all()) as Channel[];
}

export async function listAllChannels(): Promise<Channel[]> {
  const db = getDb();
  const cursor = await db.query(`FOR c IN ${COLLECTION} RETURN c`);
  return (await cursor.all()) as Channel[];
}

export async function upsertChannel(channel: Omit<Channel, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<Channel> {
  await ensureChannelsCollection();
  const db = getDb();
  const now = Date.now();
  const doc = {
    ...channel,
    createdAt: channel.createdAt ?? now,
    updatedAt: now,
  };
  const collection = db.collection(COLLECTION);
  try {
    const existing = await collection.document(channel._key);
    await collection.update(channel._key, { ...doc, createdAt: existing.createdAt });
    return { ...doc, createdAt: existing.createdAt } as Channel;
  } catch {
    await collection.save(doc);
    return doc as Channel;
  }
}

export async function setChannelEnabled(channelId: string, enabled: boolean): Promise<boolean> {
  const db = getDb();
  try {
    await db.collection(COLLECTION).update(channelId, { enabled, updatedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

export async function deleteChannel(channelId: string): Promise<boolean> {
  const db = getDb();
  try {
    await db.collection(COLLECTION).remove(channelId);
    return true;
  } catch {
    return false;
  }
}