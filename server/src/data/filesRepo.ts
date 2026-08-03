// Files repository (ArangoDB)
//
// 每個上傳的檔案對應一筆文件，channelId 強制隔離。
// shortCode：分享用短碼（8 字元隨機），避免 URL 暴露 fileId/channelId。

import { randomUUID, randomBytes } from 'node:crypto';
import { getDb, ensureCollection } from '../data/arango.js';

export interface FileRecord {
  _key: string;
  fileId: string;
  shortCode: string;
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

// base62 短碼（8 字元）：62^8 ≈ 2.2e14 組合，7 天效期內暴力猜測不可行
const SHORT_CODE_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateShortCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = '';
  for (const b of bytes) {
    code += SHORT_CODE_CHARS[b % SHORT_CODE_CHARS.length];
  }
  return code;
}

export async function ensureFilesCollection(): Promise<void> {
  await ensureCollection(COLLECTION);
}

export async function createFileRecord(
  input: Omit<FileRecord, '_key' | 'fileId' | 'shortCode' | 'createdAt'> & { shortCode?: string },
): Promise<FileRecord> {
  await ensureFilesCollection();
  const db = getDb();
  const record: FileRecord = {
    ...input,
    _key: randomUUID(),
    fileId: randomUUID(),
    shortCode: input.shortCode ?? generateShortCode(),
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

export async function findByShortCode(code: string): Promise<FileRecord | null> {
  await ensureFilesCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR f IN ${COLLECTION} FILTER f.shortCode == @code LIMIT 1 RETURN f`,
    { code },
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