// Broadcasts API — 群發任務（ArangoDB 真實資料）
//
// 多租戶：每個請求帶 channelId。

import { Router } from 'express';
import { createBroadcastTask, listBroadcastTasks } from '../data/broadcastRepo.js';
import { logger } from '../agent/logger.js';

const router = Router();

function getChannelId(req: any): string | undefined {
  const q = req.query?.channelId;
  if (typeof q === 'string' && q) return q;
  const h = req.headers?.['x-channel-id'];
  if (typeof h === 'string' && h) return h;
  return undefined;
}

function toDto(t: any): Record<string, unknown> {
  return {
    id: t._key,
    title: t.title,
    status: t.status,
    total: t.total,
    sent: t.sent ?? 0,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '',
    template: t.template,
    scheduledAt: t.scheduledAt ? new Date(t.scheduledAt).toISOString().slice(0, 16).replace('T', ' ') : undefined,
  };
}

router.get('/', async (req: any, res) => {
  const channelId = getChannelId(req);
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  try {
    const tasks = await listBroadcastTasks(channelId);
    res.json({ data: tasks.map(toDto) });
  } catch (e) {
    logger.error('broadcasts.list.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

router.post('/', async (req: any, res) => {
  const channelId = getChannelId(req);
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  const { title, contactIds, template } = req.body ?? {};
  if (!title || !Array.isArray(contactIds) || !template) {
    return res.status(400).json({ error: 'title, contactIds, template required' });
  }
  try {
    const task = await createBroadcastTask({
      channelId,
      title,
      status: 'scheduled',
      template,
      contactIds,
      total: contactIds.length,
      sent: 0,
      scheduledAt: Date.now() + 86400000, // 預設明天（mock 行為一致）
    });
    res.json({ data: toDto(task) });
  } catch (e) {
    logger.error('broadcasts.create.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

export default router;
