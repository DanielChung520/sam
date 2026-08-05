// News push task repository — 發送好友批次任務持久化（ArangoDB）
//
// 背景：LINE 流量管制，每批次最多送 8 人、批間隔 5 分鐘。
// 發送好友時建立一個任務（targets = 全部選中好友），由 newsPushScheduler
// 依 nextBatchAt 逐批處理（每批 ≤ batchSize），sent 累計進度。
//
// 另外保存「發送好友設定」（news_push_settings，每 channel 一份）：業務員勾選好友後
// 保存，news scheduler 抓好新聞後隨即依 targets 建立批次任務發送（時機與新聞追蹤一致）。
//
// 多租戶：所有查詢帶 channelId 過濾（憲法級規範）。

import { randomUUID } from 'node:crypto';
import { getDb, ensureCollection } from './arango.js';

export type NewsPushStatus = 'pending' | 'sending' | 'completed' | 'failed';

export interface NewsPushTask {
  _key: string;
  channelId: string;
  targets: string[];           // LINE userId 清單（依序分批發送）
  total: number;
  sent: number;
  status: NewsPushStatus;
  batchSize: number;           // 每批人數上限（預設 8）
  batchIntervalMs: number;     // 批間隔（預設 5 分鐘）
  nextBatchAt: number;         // 下一批可發送時間戳（首批=建立當下）
  createdAt: number;
  completedAt?: number;
  error?: string;
}

const COLLECTION = 'news_push_tasks';

export async function ensureNewsPushCollection(): Promise<void> {
  await ensureCollection(COLLECTION);
}

export async function createNewsPushTask(
  input: Omit<NewsPushTask, '_key' | 'createdAt'>,
): Promise<NewsPushTask> {
  await ensureNewsPushCollection();
  const db = getDb();
  const doc: NewsPushTask = { ...input, _key: randomUUID(), createdAt: Date.now() };
  await db.collection(COLLECTION).save(doc);
  return doc;
}

export async function getNewsPushTask(id: string): Promise<NewsPushTask | null> {
  await ensureNewsPushCollection();
  const db = getDb();
  try {
    return (await db.collection(COLLECTION).document(id)) as NewsPushTask;
  } catch {
    return null;
  }
}

/** 列出某 channel 的發送任務（最新在前） */
export async function listNewsPushTasks(channelId: string, limit = 20): Promise<NewsPushTask[]> {
  await ensureNewsPushCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR t IN ${COLLECTION} FILTER t.channelId == @cid SORT t.createdAt DESC LIMIT @limit RETURN t`,
    { cid: channelId, limit },
  );
  return (await cursor.all()) as NewsPushTask[];
}

/** 列出所有待處理任務（pending/sending 且已到可發送時間），scheduler 用 */
export async function listDueNewsPushTasks(now = Date.now()): Promise<NewsPushTask[]> {
  await ensureNewsPushCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR t IN ${COLLECTION}
     FILTER (t.status == 'pending' OR t.status == 'sending') AND t.nextBatchAt <= @now
     SORT t.nextBatchAt ASC RETURN t`,
    { now },
  );
  return (await cursor.all()) as NewsPushTask[];
}

export async function updateNewsPushTask(
  id: string,
  patch: Partial<NewsPushTask>,
): Promise<NewsPushTask | null> {
  const existing = await getNewsPushTask(id);
  if (!existing) return null;
  await ensureNewsPushCollection();
  const db = getDb();
  const updated = { ...existing, ...patch };
  await db.collection(COLLECTION).update(id, updated);
  return updated;
}

// ─── 發送好友設定（news_push_settings）───────────────────

export interface NewsPushSetting {
  _key: string;                    // channelId
  channelId: string;
  targets: string[];               // 保存的好友 LINE userId 清單
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

const SETTING_COLLECTION = 'news_push_settings';

export async function ensureNewsPushSettingCollection(): Promise<void> {
  await ensureCollection(SETTING_COLLECTION);
}

/** 取得某 channel 的發送好友設定（無則回 null） */
export async function getPushSetting(channelId: string): Promise<NewsPushSetting | null> {
  await ensureNewsPushSettingCollection();
  const db = getDb();
  try {
    return (await db.collection(SETTING_COLLECTION).document(channelId)) as NewsPushSetting;
  } catch {
    return null;
  }
}

/** 保存（覆蓋式）：重新勾選即取代好友清單 */
export async function upsertPushSetting(
  channelId: string,
  fields: Partial<Omit<NewsPushSetting, '_key' | 'channelId' | 'createdAt'>>,
): Promise<NewsPushSetting> {
  await ensureNewsPushSettingCollection();
  const db = getDb();
  const existing = await getPushSetting(channelId);
  const now = Date.now();
  const doc: NewsPushSetting = {
    ...(existing ?? {
      channelId,
      targets: [],
      enabled: true,
      createdAt: now,
    }),
    ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
    _key: channelId,
    channelId,
    updatedAt: now,
  };
  await db.collection(SETTING_COLLECTION).save(doc, { overwriteMode: 'replace' });
  return doc;
}
