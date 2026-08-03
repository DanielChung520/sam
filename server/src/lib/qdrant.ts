// Qdrant client wrapper
//
// 兩主要 collections:
//   - sam_memories  — L2 entity embeddings（per customerId filter）
//   - sam_business  — L3 business KB embeddings（per channelId filter）
//
// 兩邊 vector dim 必須一致（用同一個 embedder）

import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

let client: QdrantClient | null = null;

export function getQdrant(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: QDRANT_URL });
  }
  return client;
}

export const QDRANT_COLLECTIONS = {
  MEMORIES: 'sam_memories',
  BUSINESS: 'sam_business',
} as const;

export async function ensureQdrantCollection(
  name: string,
  vectorSize: number
): Promise<void> {
  const q = getQdrant();
  try {
    await q.getCollection(name);
  } catch {
    await q.createCollection(name, {
      vectors: { size: vectorSize, distance: 'Cosine' },
    });
  }
}

export async function ensurePayloadIndexes(): Promise<void> {
  const q = getQdrant();
  // sam_memories: customerId + category + forgotten + updatedAt
  await q.createPayloadIndex(QDRANT_COLLECTIONS.MEMORIES, {
    field_name: 'customerId',
    field_schema: 'keyword',
  }).catch(() => undefined);
  await q.createPayloadIndex(QDRANT_COLLECTIONS.MEMORIES, {
    field_name: 'category',
    field_schema: 'keyword',
  }).catch(() => undefined);
  await q.createPayloadIndex(QDRANT_COLLECTIONS.MEMORIES, {
    field_name: 'forgotten',
    field_schema: 'bool',
  }).catch(() => undefined);

  // sam_business: channelId + type + enabled
  await q.createPayloadIndex(QDRANT_COLLECTIONS.BUSINESS, {
    field_name: 'channelId',
    field_schema: 'keyword',
  }).catch(() => undefined);
  await q.createPayloadIndex(QDRANT_COLLECTIONS.BUSINESS, {
    field_name: 'type',
    field_schema: 'keyword',
  }).catch(() => undefined);
  await q.createPayloadIndex(QDRANT_COLLECTIONS.BUSINESS, {
    field_name: 'enabled',
    field_schema: 'bool',
  }).catch(() => undefined);
}