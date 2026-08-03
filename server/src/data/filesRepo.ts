// Files repository (ArangoDB)
//
// 每個上傳的檔案對應一筆文件，channelId 強制隔離。

import { randomUUID } from 'node:crypto';
import { getDb, ensureCollection } from '../data/arango.js';

export interface FileRecord {
  _key: string;
  fileId: string;
  channelId: string;
  ownerUserId: string;
  storageKey: string;
  filename: string;
  contentType: string;
  size: number;
  metadata?: Record<string, unknown>;
  createdAt: number;
  businessOwnerId?: string;
}

const COLLECTION = 'files';

export async function ensureFilesCollection(): Promise<void> {
  await ensureCollection(COLLECTION);
}

export async function createFileRecord(
  input: Omit<FileRecord, '_key' | 'fileId' | 'createdAt'>,
): Promise<FileRecord> {
  await ensureFilesCollection();
  const db = getDb();
  const record: FileRecord = {
    ...input,
    _key: randomUUID(),
    fileId: randomUUID(),
    createdAt: Date.now(),
  };
  await db.collection(COLLECTION).save(record);
  return record;
}

export async function findFileById(fileId: string, channelId: string): Promise<FileRecord | null> {
  await ensureFilesCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR f IN ${COLLECTION} FILTER f.fileId == @fileId LIMIT 1 RETURN f`,
    { fileId },
  );
  const results = (await cursor.all()) as FileRecord[];
  const file = results[0];
  if (!file) return null;
  if (file.channelId !== channelId) return null;
  return file;
}

export async function findFileByKey(fileId: string): Promise<FileRecord | null> {
  await ensureFilesCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR f IN ${COLLECTION} FILTER f.fileId == @fileId LIMIT 1 RETURN f`,
    { fileId },
  );
  const results = (await cursor.all()) as FileRecord[];
  return results[0] ?? null;
}

export async function listFilesByChannel(channelId: string, limit = 50): Promise<FileRecord[]> {
  await ensureFilesCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR f IN ${COLLECTION} FILTER f.channelId == @cid SORT f.createdAt DESC LIMIT @limit RETURN f`,
    { cid: channelId, limit },
  );
  return (await cursor.all()) as FileRecord[];
}

export async function deleteFileRecord(fileId: string, channelId: string): Promise<boolean> {
  await ensureFilesCollection();
  const db = getDb();
  const file = await findFileById(fileId, channelId);
  if (!file) return false;
  await db.collection(COLLECTION).remove(file._key);
  return true;
}