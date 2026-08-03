// Relationship repository (ArangoDB edge collection)
// L2 圖譜記憶庫的邊 collection
//
// Edge document shape:
//   - _key, _from (memory entity key), _to (memory entity key)
//   - type: 'prefers' | 'related_to' | 'happened_on' | 'owns' | 'discussed'
//   - confidence, evidence, createdAt

import { getDb, ensureEdgeCollection } from './arango.js';
import type { MemoryEntity } from './memoryRepo.js';

export type RelationshipType = 'prefers' | 'related_to' | 'happened_on' | 'owns' | 'discussed';

export interface MemoryRelationship {
  _key: string;
  _from: string;     // MemoryEntity _key
  _to: string;       // MemoryEntity _key
  type: RelationshipType;
  confidence: number;
  evidence?: string;
  createdAt: number;
}

const EDGE_COLLECTION = 'memory_relationships';

let initialized = false;

async function ensure(): Promise<void> {
  if (initialized) return;
  await ensureEdgeCollection(EDGE_COLLECTION);
  initialized = true;
}

export async function createRelationship(input: Omit<MemoryRelationship, '_key' | 'createdAt'>): Promise<MemoryRelationship> {
  await ensure();
  const db = getDb();
  const doc = {
    ...input,
    createdAt: Date.now(),
  };
  await db.collection(EDGE_COLLECTION).save(doc);
  return doc as MemoryRelationship;
}

export async function findRelationshipsFor(entityKeys: string[]): Promise<MemoryRelationship[]> {
  if (entityKeys.length === 0) return [];
  await ensure();
  const db = getDb();
  const cursor = await db.query({
    query: `FOR e IN ${EDGE_COLLECTION}
      FILTER e._from IN @keys OR e._to IN @keys
      RETURN e`,
    bindVars: { keys: entityKeys },
  });
  return (await cursor.all()) as MemoryRelationship[];
}

export async function deleteRelationshipsFor(entityKey: string): Promise<number> {
  await ensure();
  const db = getDb();
  const cursor = await db.query({
    query: `FOR e IN ${EDGE_COLLECTION}
      FILTER e._from == @key OR e._to == @key
      REMOVE e IN ${EDGE_COLLECTION}
      RETURN 1`,
    bindVars: { key: entityKey },
  });
  return (await cursor.all()).length;
}