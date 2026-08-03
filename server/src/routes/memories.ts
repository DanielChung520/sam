// User Memory API
//
// 用戶查詢 / 忘記我 的公開介面
//
// GET  /api/v1/memories          — 列自己的 memory entities（per channelId）
// GET  /api/v1/memories/forgotten — 列出已 forgotten 的（透明性）
// POST /api/v1/memories/forget-me — 把所有 entities 標記 forgotten
// DELETE /api/v1/memories/:key    — 刪單筆（user 自己刪特定記憶）
//
// 注意：customerId 從認證 middleware 取，這裡用 channelId + customerToken 模擬

import { Router, type Request, type Response } from 'express';
import {
  listEntitiesByCustomer,
  findEntityById,
  markForgotten,
} from '../data/memoryRepo.js';
import { logger } from '../agent/logger.js';

const router = Router();

interface AuthedRequest extends Request {
  customerId?: string;
}

function getCustomerId(req: AuthedRequest, res: Response): string | null {
  const cid = req.customerId ?? req.header('x-customer-token');
  if (!cid) {
    res.status(401).json({ error: 'customer token required' });
    return null;
  }
  return cid;
}

router.get('/memories', async (req: AuthedRequest, res: Response) => {
  try {
    const cid = getCustomerId(req, res);
    if (!cid) return;
    const channelId = (req.query.channelId as string) || undefined;
    const all = await listEntitiesByCustomer(cid, { includeForgotten: false });
    const filtered = channelId ? all.filter((m) => m.channelId === channelId) : all;
    res.json({ data: filtered });
  } catch (e) {
    logger.error('user.memories.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/memories/forgotten', async (req: AuthedRequest, res: Response) => {
  try {
    const cid = getCustomerId(req, res);
    if (!cid) return;
    const all = await listEntitiesByCustomer(cid, { includeForgotten: true });
    const forgotten = all.filter((m) => m.forgotten);
    res.json({ data: forgotten });
  } catch (e) {
    logger.error('user.memories.forgotten.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/memories/forget-me', async (req: AuthedRequest, res: Response) => {
  try {
    const cid = getCustomerId(req, res);
    if (!cid) return;
    const all = await listEntitiesByCustomer(cid, { includeForgotten: false });
    let count = 0;
    for (const m of all) {
      const ok = await markForgotten(m._key);
      if (ok) count++;
    }
    logger.info('user.memories.forget_me.completed', { customerId: cid, count });
    res.json({ data: { forgotten: count } });
  } catch (e) {
    logger.error('user.memories.forget_me.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.delete('/memories/:key', async (req: AuthedRequest, res: Response) => {
  try {
    const cid = getCustomerId(req, res);
    if (!cid) return;
    const key = String(req.params.key);
    const entity = await findEntityById(key);
    if (!entity) return res.status(404).json({ error: 'memory not found' });
    if (entity.customerId !== cid) return res.status(403).json({ error: 'forbidden' });
    const ok = await markForgotten(key);
    if (!ok) return res.status(500).json({ error: 'failed to mark forgotten' });
    res.json({ data: { deleted: true, key: req.params.key } });
  } catch (e) {
    logger.error('user.memories.delete.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;