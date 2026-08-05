// Workspace routes — 新聞追蹤 / 賀卡樣板 / USB 狀態
//
// news 相關改為 DB 驅動：
//   GET  /news            某 channel 已抓取的新聞（channelId 隔離）
//   GET  /news/subscription  訂閱設定
//   PATCH /news/subscription 更新訂閱設定
//   POST /news/fetch      手動觸發立即抓取一輪
// greetings / usb/status 仍為 mock 樣板（UI 規格階段）。

import { Router } from 'express';
import { greetingTemplates, usbStatus } from '../data/mock.js';
import {
  getSubscription,
  upsertSubscription,
  listNewsItems,
} from '../data/newsRepo.js';
import { fetchAllTopics, createNewsPush, processNewsPushBatch } from '../agent/newsService.js';
import { listNewsPushTasks, getPushSetting, upsertPushSetting } from '../data/newsPushRepo.js';
import { getChannelId } from '../lib/authJwt.js';
import { logger } from '../agent/logger.js';

const router = Router();

function requireChannel(req: any, res: any): string | null {
  const channelId = getChannelId(req);
  if (!channelId) {
    res.status(400).json({ error: 'channelId required (query or x-channel-id)' });
    return null;
  }
  return channelId;
}

// GET /api/v1/greetings - 賀卡樣板列表（mock）
router.get('/greetings', (req, res) => {
  const { category } = req.query;
  let result = [...greetingTemplates];
  if (category && typeof category === 'string') {
    result = result.filter(g => g.category === category);
  }
  res.json({ data: result });
});

// GET /api/v1/news - 某 channel 已抓取的新聞
router.get('/news', async (req: any, res: any) => {
  const channelId = requireChannel(req, res);
  if (!channelId) return;
  const { category, topic } = req.query;
  try {
    let items = await listNewsItems(channelId, 50);
    if (topic && typeof topic === 'string') {
      items = items.filter((n) => n.topic === topic);
    } else if (category && typeof category === 'string' && category !== '全部') {
      items = items.filter((n) => n.category === category);
    }
    res.json({
      data: items.map((n) => ({
        id: n._key,
        category: n.category,
        topic: n.topic,
        title: n.title,
        summary: n.summary,
        analysis: n.analysis,
        source: n.source,
        time: n.time,
        url: n.url,
      })),
    });
  } catch (e) {
    logger.error('news.list.failed', { channelId, error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/v1/news/subscription - 訂閱設定
router.get('/news/subscription', async (req: any, res: any) => {
  const channelId = requireChannel(req, res);
  if (!channelId) return;
  try {
    const sub = await getSubscription(channelId);
    res.json({ data: sub });
  } catch (e) {
    logger.error('news.sub.get.failed', { channelId, error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// PATCH /api/v1/news/subscription - 更新訂閱設定
router.patch('/news/subscription', async (req: any, res: any) => {
  const channelId = requireChannel(req, res);
  if (!channelId) return;
  const body = req.body ?? {};
  try {
    const updated = await upsertSubscription(channelId, {
      topics: Array.isArray(body.topics) ? body.topics.map(String) : undefined,
      summaryLen: ['short', 'medium', 'full'].includes(body.summaryLen) ? body.summaryLen : undefined,
      autoSummarize: typeof body.autoSummarize === 'boolean' ? body.autoSummarize : undefined,
      highlightKeywords: typeof body.highlightKeywords === 'boolean' ? body.highlightKeywords : undefined,
      analysisPrompt: typeof body.analysisPrompt === 'string' ? body.analysisPrompt : undefined,
      schedule: body.schedule ?? undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    });
    res.json({ data: updated });
  } catch (e) {
    logger.error('news.sub.patch.failed', { channelId, error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/v1/news/fetch - 手動觸發立即抓取一輪（不等待結果，背景執行）
router.post('/news/fetch', async (req: any, res: any) => {
  const channelId = requireChannel(req, res);
  if (!channelId) return;
  try {
    const sub = await getSubscription(channelId);
    if (!sub || sub.topics.length === 0) {
      return res.status(400).json({ error: 'no subscription topics configured' });
    }
    res.json({ ok: true, message: 'fetch started' });
    fetchAllTopics(channelId, sub).catch((e) =>
      logger.error('news.fetch.failed', { channelId, error: String(e) })
    );
  } catch (e) {
    logger.error('news.fetch.start.failed', { channelId, error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/v1/news/push - 建立發送任務（LINE 流量管制：每批 ≤8 人、批間隔 5 分鐘，
// 由 newsPushScheduler 背景逐批發送）。回傳 taskId 供 GET /news/push/tasks 查進度。
router.post('/news/push', async (req: any, res: any) => {
  const channelId = requireChannel(req, res);
  if (!channelId) return;
  const body = req.body ?? {};
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((id: unknown) => typeof id === 'string')
    : typeof body.userId === 'string'
      ? [body.userId]
      : [];
  if (userIds.length === 0) {
    return res.status(400).json({ error: 'userIds required' });
  }
  try {
    const task = await createNewsPush(channelId, userIds);
    const batches = Math.ceil(task.total / task.batchSize);
    res.json({ ok: true, taskId: task._key, total: task.total, batches });
    // 首批立即發送（scheduler 3 秒內也會接手，此處直接觸發加快回饋）
    void processNewsPushBatch(task).catch((e) =>
      logger.error('news.push.route.batch_failed', { channelId, error: String(e) })
    );
  } catch (e) {
    logger.error('news.push.start.failed', { channelId, error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/v1/news/push/tasks - 發送任務清單與進度（client 輪詢用）
router.get('/news/push/tasks', async (req: any, res: any) => {
  const channelId = requireChannel(req, res);
  if (!channelId) return;
  try {
    const tasks = await listNewsPushTasks(channelId, 20);
    res.json({
      data: tasks.map((t) => ({
        id: t._key,
        status: t.status,
        total: t.total,
        sent: t.sent,
        batchSize: t.batchSize,
        batchIntervalMs: t.batchIntervalMs,
        nextBatchAt: t.nextBatchAt,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
    });
  } catch (e) {
    logger.error('news.push.tasks.failed', { channelId, error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/v1/news/push/setting - 取得發送好友設定（好友清單）
router.get('/news/push/setting', async (req: any, res: any) => {
  const channelId = requireChannel(req, res);
  if (!channelId) return;
  try {
    const setting = await getPushSetting(channelId);
    if (!setting) return res.json({ data: null });
    res.json({
      data: {
        targets: setting.targets,
        enabled: setting.enabled,
        updatedAt: setting.updatedAt,
      },
    });
  } catch (e) {
    logger.error('news.push.setting.get.failed', { channelId, error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// PUT /api/v1/news/push/setting - 保存發送好友設定（覆蓋式：重新勾選即取代）
// body: { userIds: string[] }
// 發送時機與新聞追蹤一致：news scheduler 抓好新聞後隨即自動發送
router.put('/news/push/setting', async (req: any, res: any) => {
  const channelId = requireChannel(req, res);
  if (!channelId) return;
  const body = req.body ?? {};
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((id: unknown) => typeof id === 'string')
    : [];
  try {
    const setting = await upsertPushSetting(channelId, {
      targets: userIds,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    });
    res.json({ ok: true, total: setting.targets.length });
  } catch (e) {
    logger.error('news.push.setting.save.failed', { channelId, error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/v1/usb/status - USB 狀態
router.get('/usb/status', (req, res) => {
  res.json({ data: usbStatus });
});

export default router;
