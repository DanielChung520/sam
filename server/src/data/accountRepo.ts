// Business Account repository（ArangoDB）

import { getDb, ensureCollection } from './arango.js';

export interface BusinessAccount {
  _key: string;
  name: string;
  email: string;
  businessOwnerId: string;
  channelIds: string[];
  enabled: boolean;
  source: 'admin' | 'web';
  createdAt: number;
  updatedAt: number;
}

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
