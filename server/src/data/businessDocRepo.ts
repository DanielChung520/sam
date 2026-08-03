// Business KB Document repository (ArangoDB)
// L3 業務靜態知識庫 — 產品、價目、FAQ、政策、菜單
//
// Schema:
//   - _key: 'kb:{channelId}:{slug}'
//   - type: 'product' | 'pricing' | 'faq' | 'policy' | 'menu'
//   - 每個 doc 同步寫入 Qdrant 的 sam_business collection
//
// 索引：
//   - hash(channelId) — per-channel 查詢
//   - hash(type) — 分類過濾

import { getDb, ensureCollection, ensureHashIndex } from './arango.js';

export type BusinessDocType = 'product' | 'pricing' | 'faq' | 'policy' | 'menu';

export interface BusinessDoc {
  _key: string;
  channelId: string;
  type: BusinessDocType;
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;

  createdAt: number;
  updatedAt: number;
}

const COLLECTION = 'business_docs';

let initialized = false;

export async function ensureBusinessDocsCollection(): Promise<void> {
  if (initialized) return;
  await ensureCollection(COLLECTION);
  await ensureHashIndex(COLLECTION, ['channelId']);
  await ensureHashIndex(COLLECTION, ['type']);
  initialized = true;
}

/* ── CRUD ── */

export async function listByChannel(
  channelId: string,
  options: { type?: BusinessDocType; enabledOnly?: boolean } = {}
): Promise<BusinessDoc[]> {
  await ensureBusinessDocsCollection();
  const db = getDb();
  const filters: string[] = ['d.channelId == @channelId'];
  if (options.type) filters.push('d.type == @type');
  if (options.enabledOnly !== false) filters.push('d.enabled == true');

  const cursor = await db.query({
    query: `FOR d IN ${COLLECTION}
      FILTER ${filters.join(' AND ')}
      SORT d.updatedAt DESC
      RETURN d`,
    bindVars: { channelId, type: options.type },
  });
  return (await cursor.all()) as BusinessDoc[];
}

export async function findDocById(_key: string): Promise<BusinessDoc | null> {
  await ensureBusinessDocsCollection();
  const db = getDb();
  try {
    return (await db.collection(COLLECTION).document(_key)) as BusinessDoc;
  } catch {
    return null;
  }
}

export async function upsertDoc(input: Omit<BusinessDoc, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<BusinessDoc> {
  await ensureBusinessDocsCollection();
  const db = getDb();
  const now = Date.now();
  const doc = {
    ...input,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
  const col = db.collection(COLLECTION);
  try {
    await col.document(input._key);
    await col.update(input._key, doc);
    return doc as BusinessDoc;
  } catch {
    await col.save(doc);
    return doc as BusinessDoc;
  }
}

export async function deleteDoc(_key: string): Promise<boolean> {
  await ensureBusinessDocsCollection();
  const db = getDb();
  try {
    await db.collection(COLLECTION).remove(_key);
    return true;
  } catch {
    return false;
  }
}

export function generateDocKey(channelId: string, slug: string): string {
  const safe = slug.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 50);
  return `kb:${channelId}:${safe}`;
}