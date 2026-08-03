// Message repository — LINE 對話訊息持久化（ArangoDB）
//
// 每則訊息一筆文件，channelId + userId 隔離。
// 資料來源：webhook 收到的訊息（direction: 'in'）+ 發送（direction: 'out'）。

import { getDb, ensureCollection } from './arango.js';

export interface Message {
  _key: string;                    // 'm:{channelId}:{userId}:{messageId}'
  channelId: string;
  userId: string;                  // 客戶 LINE userId
  direction: 'in' | 'out';         // in=客戶傳來, out=我們發送
  type: string;                    // text | image | audio | file ...
  text?: string;
  mediaStorageKey?: string;        // 多媒體：SeaweedFS storage key
  replyToken?: string;
  messageId?: string;              // LINE message id
  createdAt: number;
}

const COLLECTION = 'messages';

export async function ensureMessagesCollection(): Promise<void> {
  await ensureCollection(COLLECTION);
}

export async function createMessage(input: Omit<Message, '_key' | 'createdAt'>): Promise<Message> {
  await ensureMessagesCollection();
  const db = getDb();
  const idPart = input.messageId ?? Date.now().toString();
  const _key = `m:${input.channelId}:${input.userId}:${idPart}`;
  const doc: Message = { ...input, _key, createdAt: Date.now() };
  await db.collection(COLLECTION).save(doc);
  return doc;
}

/** 列出某 channel 與某用戶的對話（最新在前，limit 筆） */
export async function listMessages(channelId: string, userId: string, limit = 100): Promise<Message[]> {
  await ensureMessagesCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR m IN ${COLLECTION} FILTER m.channelId == @cid AND m.userId == @uid SORT m.createdAt DESC LIMIT @limit RETURN m`,
    { cid: channelId, uid: userId, limit },
  );
  return (await cursor.all()) as Message[];
}

/** 每用戶最後一則訊息（對話列表用） */
export async function listLastMessagesByChannel(channelId: string): Promise<Record<string, Message>> {
  await ensureMessagesCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR m IN ${COLLECTION}
     FILTER m.channelId == @cid
     SORT m.createdAt DESC
     COLLECT uid = m.userId INTO groups
     LET last = FIRST(groups[*].m)
     RETURN { userId: uid, last }`,
    { cid: channelId },
  );
  const rows = (await cursor.all()) as Array<{ userId: string; last: Message }>;
  const map: Record<string, Message> = {};
  for (const r of rows) map[r.userId] = r.last;
  return map;
}
