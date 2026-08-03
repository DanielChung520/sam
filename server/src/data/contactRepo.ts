// Contact repository — LINE 好友（客戶）持久化（ArangoDB）
//
// 每個 channel 的好友一筆文件，channelId + userId 隔離。
// 資料來源：webhook 事件被動累積（follow / 來訊）+ getProfile 補資料。

import { getDb, ensureCollection } from './arango.js';

export interface Contact {
  _key: string;                    // 'c:{channelId}:{userId}'
  channelId: string;
  userId: string;                  // LINE userId
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  title?: string;                  // 職稱（相容舊欄位）
  nickname?: string;               // 暱稱（相容舊欄位）
  honorific?: string;              // 尊稱（相容舊欄位）
  salutation?: string;             // 稱謂（單一欄位，供祝賀/名片回覆使用）
  gender?: string;                 // 性別（male/female）
  phone?: string;                  // 電話
  email?: string;                  // Email
  company?: string;                // 公司
  address?: string;                // 地址
  remark?: string;                 // 備註
  tags: string[];
  score: number;
  lastMessageAt?: number;
  unreadCount: number;
  isBlocked: boolean;
  followedAt?: number;
  createdAt: number;
  updatedAt: number;
}

const COLLECTION = 'contacts';

export async function ensureContactsCollection(): Promise<void> {
  await ensureCollection(COLLECTION);
}

function contactKey(channelId: string, userId: string): string {
  return `c:${channelId}:${userId}`;
}

export async function upsertContact(input: Omit<Contact, '_key' | 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<Contact> {
  await ensureContactsCollection();
  const db = getDb();
  const now = Date.now();
  const _key = contactKey(input.channelId, input.userId);
  const doc: Contact = {
    ...input,
    _key,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
  try {
    const existing = await db.collection(COLLECTION).document(_key);
    await db.collection(COLLECTION).update(_key, { ...doc, createdAt: existing.createdAt });
    return { ...doc, createdAt: existing.createdAt as number };
  } catch {
    await db.collection(COLLECTION).save(doc);
    return doc;
  }
}

export async function findContact(channelId: string, userId: string): Promise<Contact | null> {
  await ensureContactsCollection();
  const db = getDb();
  try {
    return (await db.collection(COLLECTION).document(contactKey(channelId, userId))) as Contact;
  } catch {
    return null;
  }
}

export async function listContactsByChannel(channelId: string): Promise<Contact[]> {
  await ensureContactsCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR c IN ${COLLECTION} FILTER c.channelId == @cid AND c.isBlocked != true SORT c.updatedAt DESC RETURN c`,
    { cid: channelId },
  );
  return (await cursor.all()) as Contact[];
}

export async function markContactUnread(channelId: string, userId: string, isUnread: boolean): Promise<void> {
  const contact = await findContact(channelId, userId);
  if (!contact) return;
  const unreadCount = isUnread ? (contact.unreadCount ?? 0) + 1 : 0;
  await upsertContact({ ...contact, unreadCount });
}

export async function updateContactProfile(
  channelId: string,
  userId: string,
  profile: {
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
    title?: string;
    nickname?: string;
    honorific?: string;
    salutation?: string;
    gender?: string;
    phone?: string;
    email?: string;
    company?: string;
    address?: string;
    remark?: string;
    tags?: string[];
  },
): Promise<void> {
  const existing = await findContact(channelId, userId);
  if (!existing) {
    await upsertContact({
      channelId,
      userId,
      displayName: profile.displayName ?? '好友',
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage,
      title: profile.title,
      nickname: profile.nickname,
      honorific: profile.honorific,
      salutation: profile.salutation,
      gender: profile.gender,
      phone: profile.phone,
      email: profile.email,
      company: profile.company,
      address: profile.address,
      remark: profile.remark,
      tags: profile.tags ?? [],
      score: 0,
      unreadCount: 0,
      isBlocked: false,
      followedAt: Date.now(),
    });
    return;
  }
  await upsertContact({
    ...existing,
    displayName: profile.displayName ?? existing.displayName,
    pictureUrl: profile.pictureUrl ?? existing.pictureUrl,
    statusMessage: profile.statusMessage ?? existing.statusMessage,
    title: profile.title !== undefined ? profile.title : existing.title,
    nickname: profile.nickname !== undefined ? profile.nickname : existing.nickname,
    honorific: profile.honorific !== undefined ? profile.honorific : existing.honorific,
    salutation: profile.salutation !== undefined ? profile.salutation : existing.salutation,
    gender: profile.gender !== undefined ? profile.gender : existing.gender,
    phone: profile.phone !== undefined ? profile.phone : existing.phone,
    email: profile.email !== undefined ? profile.email : existing.email,
    company: profile.company !== undefined ? profile.company : existing.company,
    address: profile.address !== undefined ? profile.address : existing.address,
    remark: profile.remark !== undefined ? profile.remark : existing.remark,
    tags: profile.tags ?? existing.tags,
  });
}
