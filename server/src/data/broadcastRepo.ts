// Broadcast repository — 群發任務持久化（ArangoDB）

import { randomUUID } from 'node:crypto';
import { getDb, ensureCollection } from './arango.js';

export type BroadcastStatus = 'scheduled' | 'sending' | 'completed' | 'failed';

export interface BroadcastTask {
  _key: string;
  channelId: string;
  title: string;
  status: BroadcastStatus;
  template: string;
  contactIds: string[];       // LINE userId 清單
  total: number;
  sent: number;
  createdAt: number;
  scheduledAt?: number;
  completedAt?: number;
  error?: string;
}

const COLLECTION = 'broadcast_tasks';

export async function ensureBroadcastCollection(): Promise<void> {
  await ensureCollection(COLLECTION);
}

export async function createBroadcastTask(input: Omit<BroadcastTask, '_key' | 'createdAt'>): Promise<BroadcastTask> {
  await ensureBroadcastCollection();
  const db = getDb();
  const doc: BroadcastTask = { ...input, _key: randomUUID(), createdAt: Date.now() };
  await db.collection(COLLECTION).save(doc);
  return doc;
}

export async function listBroadcastTasks(channelId: string): Promise<BroadcastTask[]> {
  await ensureBroadcastCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR b IN ${COLLECTION} FILTER b.channelId == @cid SORT b.createdAt DESC RETURN b`,
    { cid: channelId },
  );
  return (await cursor.all()) as BroadcastTask[];
}

export async function getBroadcastTask(id: string): Promise<BroadcastTask | null> {
  await ensureBroadcastCollection();
  const db = getDb();
  try {
    return (await db.collection(COLLECTION).document(id)) as BroadcastTask;
  } catch {
    return null;
  }
}

export async function updateBroadcastTask(id: string, patch: Partial<BroadcastTask>): Promise<BroadcastTask | null> {
  const existing = await getBroadcastTask(id);
  if (!existing) return null;
  await ensureBroadcastCollection();
  const db = getDb();
  const updated = { ...existing, ...patch };
  await db.collection(COLLECTION).update(id, updated);
  return updated;
}

export async function incrementBroadcastSent(id: string): Promise<void> {
  const task = await getBroadcastTask(id);
  if (!task) return;
  const sent = (task.sent ?? 0) + 1;
  const status: BroadcastStatus = sent >= (task.total ?? 0) ? 'completed' : 'sending';
  await updateBroadcastTask(id, { sent, status, completedAt: status === 'completed' ? Date.now() : undefined });
}
