// News Scheduler — 依訂閱排程定時抓取新聞
//
// 啟動時註冊一個每分鐘檢查一次的 timer：逐個啟用的訂閱檢查是否該抓了
// （依 schedule.type / timesPerDay / lastRunAt 計算下次時間），到期才執行。
// 用 setTimeout 鏈（非 setInterval），避免前一次執行未完成時疊跑。

import { listEnabledSubscriptions, upsertSubscription, type NewsSubscription, type NewsSchedule } from '../data/newsRepo.js';
import { fetchAllTopics, dispatchPushToTargets } from './newsService.js';
import { logger } from './logger.js';

const CHECK_INTERVAL_MS = 60_000;
const MIN_GAP_MS = 15 * 60 * 1000; // 單主題最小間隔 15 分鐘，防止排程誤設時狂抓

let timer: NodeJS.Timeout | null = null;

export function startNewsScheduler(): void {
  if (timer) return;
  logger.info('news.scheduler.started', { checkIntervalMs: CHECK_INTERVAL_MS });
  timer = setTimeout(tick, 5_000);
}

export function stopNewsScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

async function tick(): Promise<void> {
  try {
    const subs = await listEnabledSubscriptions();
    for (const sub of subs) {
      if (shouldFetch(sub)) {
        logger.info('news.scheduler.fetch', { channelId: sub.channelId });
        await upsertSubscription(sub.channelId, { lastRunAt: Date.now() });
        await fetchAllTopics(sub.channelId, sub).catch((e) =>
          logger.warn('news.scheduler.topic_failed', { channelId: sub.channelId, error: String(e) })
        );
        // 抓好新聞後隨即發送給已保存的好友清單（時機與新聞追蹤一致）
        await dispatchPushToTargets(sub.channelId).catch((e) =>
          logger.warn('news.scheduler.push_failed', { channelId: sub.channelId, error: String(e) })
        );
      }
    }
  } catch (e) {
    logger.warn('news.scheduler.tick_failed', { error: String(e) });
  } finally {
    timer = setTimeout(tick, CHECK_INTERVAL_MS);
  }
}

/** 判斷某排程是否到期該執行（news 抓取與 push 設定共用） */
export function shouldFetch(input: {
  enabled?: boolean;
  topics?: string[];
  lastRunAt?: number;
  schedule?: Partial<NewsSchedule>;
}): boolean {
  if (input.enabled === false || !input.topics || input.topics.length === 0) return false;
  const now = Date.now();
  const last = input.lastRunAt ?? 0;
  if (now - last < MIN_GAP_MS) return false;

  const s = input.schedule ?? {};
  const type = s.type ?? 'daily';
  const startHour = Math.min(Math.max(s.startHour ?? 8, 0), 23);
  const timesPerDay = Math.min(Math.max(s.timesPerDay ?? 1, 1), 24);
  const intervalHours = Math.max(s.intervalHours ?? 0, 1);
  const tz = s.followSystem === false ? (s.tzOffset ?? 0) : 0;

  const localNow = new Date(now + tz * 3600_000);
  const dayStart = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
  ) - tz * 3600_000;

  if (type === 'weekly') {
    const days = s.days ?? [1, 2, 3, 4, 5];
    if (!days.includes(localNow.getUTCDay())) return false;
    // 每週：一天至多抓一次，且僅在每日 startHour 後到點（用日期 key 判斷）
    const todaySlot = dayStart + startHour * 3600_000;
    const lastDay = new Date(last + tz * 3600_000).toDateString();
    if (localNow.toDateString() === lastDay) return false;
    return now >= todaySlot;
  }

  // daily：依 startHour 起算，每個 intervalHours 或均分時段抓一次
  let slots: number[] = [];
  if (timesPerDay <= 1) {
    slots = [dayStart + startHour * 3600_000];
  } else if (intervalHours * (timesPerDay - 1) <= 24) {
    slots = Array.from(
      { length: timesPerDay },
      (_, i) => dayStart + (startHour + i * intervalHours) * 3600_000,
    );
  } else {
    // 均分 24 小時（startHour 作為第一段起點）
    const step = 24 / timesPerDay;
    slots = Array.from(
      { length: timesPerDay },
      (_, i) => dayStart + (startHour + i * step) * 3600_000,
    );
  }

  // 現在是否已過本日某個排程時刻（且該時刻 > lastRunAt）
  return slots.some((t) => t > last && t <= now);
}
