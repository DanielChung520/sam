// Business Account repository（ArangoDB）

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDb, ensureCollection } from './arango.js';

export interface BusinessAccount {
  _key: string;
  name: string;
  email: string;
  username?: string;           // 登入帳號
  passwordHash?: string;       // scrypt hash（salt:hash）
  phone?: string;              // 手機號
  role?: string;               // 角色標記（admin / business / ...）
  lastLoginAt?: number;        // app 最新登錄日期（epoch ms）
  businessOwnerId: string;
  channelIds: string[];
  enabled: boolean;
  source: 'admin' | 'web';
  createdAt: number;
  updatedAt: number;
}

// 帳號默認密碼（建立時未指定時使用）
export const DEFAULT_PASSWORD = '1234@5';

const COLLECTION = 'business_accounts';

export async function ensureAccountsCollection(): Promise<void> {
  await ensureCollection(COLLECTION);
}

export async function listAccounts(): Promise<BusinessAccount[]> {
  await ensureAccountsCollection();
  const db = getDb();
  const cursor = await db.query(`FOR a IN ${COLLECTION} SORT a.createdAt DESC RETURN a`);
  return (await cursor.all()) as BusinessAccount[];
}

export async function findAccountById(id: string): Promise<BusinessAccount | null> {
  await ensureAccountsCollection();
  const db = getDb();
  try { return await db.collection(COLLECTION).document(id) as BusinessAccount; } catch { return null; }
}

export async function findAccountByUsername(username: string): Promise<BusinessAccount | null> {
  await ensureAccountsCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR a IN ${COLLECTION} FILTER a.username == @u LIMIT 1 RETURN a`,
    { u: username }
  );
  const results = (await cursor.all()) as BusinessAccount[];
  return results[0] ?? null;
}

// ── 密碼 hash（node crypto scrypt，零依賴）──

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function upsertAccount(input: Omit<BusinessAccount, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<BusinessAccount> {
  await ensureAccountsCollection();
  const db = getDb();
  const now = Date.now();
  const doc = { ...input, createdAt: input.createdAt ?? now, updatedAt: now };
  try {
    const existing = await db.collection(COLLECTION).document(input._key);
    await db.collection(COLLECTION).update(input._key, { ...doc, createdAt: existing.createdAt });
    return { ...doc, createdAt: existing.createdAt as number } as BusinessAccount;
  } catch {
    await db.collection(COLLECTION).save(doc);
    return doc as BusinessAccount;
  }
}

export async function deleteAccount(id: string): Promise<boolean> {
  await ensureAccountsCollection();
  const db = getDb();
  try { await db.collection(COLLECTION).remove(id); return true; } catch { return false; }
}
