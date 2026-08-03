// Memory Entity repository (ArangoDB)
// L2 圖譜記憶庫的頂點 collection
//
// Schema:
//   - _key: 'mem:{customerId}:{timestamp}:{slug}'
//   - 4 類 category: preference / fact / style / event
//   - 每個 entity 同步寫入 Qdrant 的 sam_memories collection
//
// 索引：
//   - hash(customerId) — per-user 查詢
//   - hash(category) — 分類過濾

import { getDb, ensureCollection, ensureEdgeCollection, ensureGraph, ensureHashIndex } from './arango.js';

export type MemoryCategory = 'preference' | 'fact' | 'style' | 'event';
export type MemorySource = 'extracted' | 'user_stated' | 'admin_added';

export interface MemoryEntity {
  _key: string;
  customerId: string;
  channelId: string;

  name: string;
  category: MemoryCategory;
  content: string;
  evidence: string;

  confidence: number;
  source: MemorySource;

  createdAt: number;
  updatedAt: number;
  expiresAt?: number;

  supersededBy?: string;
  forgotten?: boolean;
}

const COLLECTION = 'memory_entities';
const EDGE_COLLECTION = 'memory_relationships';
const GRAPH_NAME = 'memoryGraph';

let initialized = false;

export async function ensureMemoryEntitiesCollection(): Promise<void> {
  if (initialized) return;
  await ensureCollection(COLLECTION);
  await ensureEdgeCollection(EDGE_COLLECTION);
  await ensureGraph({
    name: GRAPH_NAME,
    vertexCollections: [COLLECTION],
    edgeCollections: [EDGE_COLLECTION],
  });
  await ensureHashIndex(COLLECTION, ['customerId']);
  await ensureHashIndex(COLLECTION, ['category']);
  initialized = true;
}

/* ── CRUD ── */

export async function listEntitiesByCustomer(
  customerId: string,
  options: { category?: MemoryCategory; includeForgotten?: boolean; limit?: number } = {}
): Promise<MemoryEntity[]> {
  await ensureMemoryEntitiesCollection();
  const db = getDb();
  const filters: string[] = ['e.customerId == @customerId'];
  if (!options.includeForgotten) filters.push('!(e.forgotten == true)');
  if (options.category) filters.push('e.category == @category');

  const limit = options.limit ?? 500;
  const cursor = await db.query({
    query: `FOR e IN ${COLLECTION}
      FILTER ${filters.join(' AND ')}
      SORT e.updatedAt DESC
      LIMIT ${limit}
      RETURN e`,
    bindVars: { customerId, category: options.category },
  });
  return (await cursor.all()) as MemoryEntity[];
}

export async function findEntityById(_key: string): Promise<MemoryEntity | null> {
  await ensureMemoryEntitiesCollection();
  const db = getDb();
  try {
    const doc = await db.collection(COLLECTION).document(_key);
    return doc as MemoryEntity;
  } catch {
    return null;
  }
}

export async function findEntitiesByKeys(keys: string[]): Promise<MemoryEntity[]> {
  if (keys.length === 0) return [];
  await ensureMemoryEntitiesCollection();
  const db = getDb();
  const cursor = await db.query({
    query: `FOR e IN ${COLLECTION}
      FILTER e._key IN @keys
      RETURN e`,
    bindVars: { keys },
  });
  return (await cursor.all()) as MemoryEntity[];
}

export async function upsertEntity(input: Omit<MemoryEntity, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<MemoryEntity> {
  await ensureMemoryEntitiesCollection();
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
    return doc as MemoryEntity;
  } catch {
    await col.save(doc);
    return doc as MemoryEntity;
  }
}

export async function markForgotten(_key: string): Promise<boolean> {
  await ensureMemoryEntitiesCollection();
  const db = getDb();
  try {
    await db.collection(COLLECTION).update(_key, { forgotten: true, updatedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

export async function markSuperseded(oldKey: string, newKey: string): Promise<void> {
  await ensureMemoryEntitiesCollection();
  const db = getDb();
  try {
    await db.collection(COLLECTION).update(oldKey, { supersededBy: newKey, updatedAt: Date.now() });
  } catch {
    // old entity might not exist, that's fine
  }
}

export async function deleteEntity(_key: string): Promise<boolean> {
  await ensureMemoryEntitiesCollection();
  const db = getDb();
  try {
    await db.collection(COLLECTION).remove(_key);
    return true;
  } catch {
    return false;
  }
}

/* ── Graph traversal helpers ── */

export async function getRelatedEntities(
  entityKeys: string[],
  depth = 1
): Promise<Array<{ from: MemoryEntity; to: MemoryEntity; type: string }>> {
  if (entityKeys.length === 0) return [];
  await ensureMemoryEntitiesCollection();
  const db = getDb();
  const cursor = await db.query({
    query: `FOR v IN ${COLLECTION}
      FILTER v._key IN @keys
      FOR neighbor IN ${depth}..${depth} ANY v ${GRAPH_NAME}
        RETURN { from: v, to: neighbor.vertex, type: neighbor.edge.type }`,
    bindVars: { keys: entityKeys },
  });
  return (await cursor.all()) as Array<{ from: MemoryEntity; to: MemoryEntity; type: string }>;
}

/* ── Helpers ── */

export function generateEntityKey(customerId: string, slug: string): string {
  const safe = slug.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 50);
  return `mem:${customerId}:${Date.now()}:${safe}`;
}