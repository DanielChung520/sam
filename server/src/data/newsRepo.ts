// News repository — 新聞追蹤訂閱 + 已抓取新聞（ArangoDB）
//
// 兩個 collection：
//   - news_subscriptions：每個 channel 一份訂閱設定（主題/摘要/分析 prompt/排程/時區）
//   - news_items：已抓取的新聞（channelId 隔離，每主題一筆最新）
//
// 多租戶：所有查詢帶 channelId 過濾（憲法級規範）。

import { getDb, ensureCollection } from './arango.js';

export interface NewsSubscription {
  _key: string;                    // channelId
  channelId: string;
  topics: string[];                // 關心主題（如 ['AI 產業', '半導體']）
  summaryLen: 'short' | 'medium' | 'full';
  autoSummarize: boolean;
  highlightKeywords: boolean;
  analysisPrompt: string;          // 分析 prompt（支援 {標題} {摘要} {主題} {來源} 變數）
  schedule: {
    type: 'daily' | 'weekly';
    timesPerDay: number;           // 每日次數 1-24
    startHour: number;             // 每日首次抓取時刻（0-23，local）
    intervalHours: number;         // timesPerDay > 1 時每次間隔（local 小時）
    days: number[];                // weekly：0=日 ... 6=六
    followSystem: boolean;         // 時區跟隨系統
    tzOffset: number;              // UTC 偏移小時
  };
  enabled: boolean;
  lastRunAt?: number;              // 上次抓取時間
  createdAt: number;
  updatedAt: number;
}

export interface NewsItem {
  _key: string;                    // 'n:{channelId}:{topicKey}'
  channelId: string;
  topic: string;                   // 訂閱主題
  category: string;                // 顯示分類（今日焦點/產業/科技...）
  title: string;
  summary: string;
  source: string;
  time: string;
  analysis?: string;               // 依分析 prompt 產出的分析（選填）
  url?: string;
  fetchedAt: number;
}

const SUB_COLLECTION = 'news_subscriptions';
const ITEM_COLLECTION = 'news_items';

// ─── Subscriptions ───────────────────────────────────────

export async function ensureNewsCollections(): Promise<void> {
  await ensureCollection(SUB_COLLECTION);
  await ensureCollection(ITEM_COLLECTION);
}

/** 取得某 channel 的訂閱設定（無則回 null） */
export async function getSubscription(channelId: string): Promise<NewsSubscription | null> {
  await ensureNewsCollections();
  const db = getDb();
  try {
    const doc = await db.collection(SUB_COLLECTION).document(channelId);
    return doc as NewsSubscription;
  } catch {
    return null;
  }
}

/** 建立或更新訂閱設定（UPSERT，_key = channelId） */
export async function upsertSubscription(
  channelId: string,
  fields: Partial<Omit<NewsSubscription, '_key' | 'channelId' | 'createdAt'>>,
): Promise<NewsSubscription> {
  await ensureNewsCollections();
  const db = getDb();
  const existing = await getSubscription(channelId);
  const now = Date.now();
  const doc: NewsSubscription = {
    ...(existing ?? {
      channelId,
      topics: [],
      summaryLen: 'medium',
      autoSummarize: true,
      highlightKeywords: true,
      analysisPrompt:
        '請以銷售助理的角度分析這則新聞對我客戶的潛在影響，並提供三個具體的跟進建議。',
      schedule: {
        type: 'daily',
        timesPerDay: 1,
        startHour: 8,
        intervalHours: 4,
        days: [1, 2, 3, 4, 5],
        followSystem: true,
        tzOffset: 0,
      },
      enabled: true,
      createdAt: now,
    }),
    ...omitUndefined(fields),
    _key: channelId,
    channelId,
    updatedAt: now,
  };
  await db.collection(SUB_COLLECTION).save(doc, { overwriteMode: 'replace' });
  return doc;
}

/** 過濾 undefined 欄位，避免 PATCH 未提供的欄位覆蓋既有值 */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** 列出所有啟用的訂閱（排程 job 用） */
export async function listEnabledSubscriptions(): Promise<NewsSubscription[]> {
  await ensureNewsCollections();
  const db = getDb();
  const cursor = await db.query(
    `FOR s IN ${SUB_COLLECTION} FILTER s.enabled != false RETURN s`,
  );
  return (await cursor.all()) as NewsSubscription[];
}

// ─── News items ──────────────────────────────────────────

/** 列出某 channel 的新聞（最新在前） */
export async function listNewsItems(channelId: string, limit = 50): Promise<NewsItem[]> {
  await ensureNewsCollections();
  const db = getDb();
  const cursor = await db.query(
    `FOR n IN ${ITEM_COLLECTION} FILTER n.channelId == @cid SORT n.fetchedAt DESC LIMIT @limit RETURN n`,
    { cid: channelId, limit },
  );
  return (await cursor.all()) as NewsItem[];
}

/** 依主題存新聞（UPSERT 每主題一筆最新，避免無限累積） */
export async function upsertNewsItem(channelId: string, topic: string, item: Omit<NewsItem, '_key' | 'channelId' | 'topic' | 'fetchedAt'>): Promise<NewsItem> {
  await ensureNewsCollections();
  const db = getDb();
  const topicKey = Buffer.from(topic).toString('base64url').slice(0, 60);
  const _key = `n:${channelId}:${topicKey}`;
  const doc: NewsItem = {
    ...item,
    _key,
    channelId,
    topic,
    fetchedAt: Date.now(),
  };
  await db.collection(ITEM_COLLECTION).save(doc, { overwriteMode: 'replace' });
  return doc;
}
