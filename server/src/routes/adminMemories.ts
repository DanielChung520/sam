// Admin Memory Viewer
//
// 管理員看 / 編輯 / 刪除 user memory（debug + 合規調查用）
//
// GET    /api/v1/admin/memories         — list（filter by customerId / channelId / category / forgotten）
// GET    /api/v1/admin/memories/:key     — get single
// PATCH  /api/v1/admin/memories/:key     — edit content / confidence / category
// DELETE /api/v1/admin/memories/:key     — hard delete

import { Router } from 'express';
import {
  listEntitiesByCustomer,
  findEntityById,
  upsertEntity,
  deleteEntity,
  type MemoryCategory,
} from '../data/memoryRepo.js';
import { logger } from '../agent/logger.js';

const router = Router();

router.get('/memories', async (req, res) => {
  try {
    const customerId = req.query.customerId as string | undefined;
    if (!customerId) return res.status(400).json({ error: 'customerId required' });

    const category = req.query.category as MemoryCategory | undefined;
    const channelId = req.query.channelId as string | undefined;
    const includeForgotten = req.query.includeForgotten === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const items = await listEntitiesByCustomer(customerId, {
      category,
      includeForgotten,
      limit,
    });
    const filtered = channelId ? items.filter((m) => m.channelId === channelId) : items;
    res.json({ data: filtered });
  } catch (e) {
    logger.error('admin.memories.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/memories/:key', async (req, res) => {
  try {
    const m = await findEntityById(req.params.key);
    if (!m) return res.status(404).json({ error: 'not found' });
    res.json({ data: m });
  } catch (e) {
    logger.error('admin.memories.get.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.patch('/memories/:key', async (req, res) => {
  try {
    const existing = await findEntityById(req.params.key);
    if (!existing) return res.status(404).json({ error: 'not found' });

    const { name, category, content, confidence } = req.body ?? {};
    const updated = await upsertEntity({
      ...existing,
      name: name ?? existing.name,
      category: category ?? existing.category,
      content: content ?? existing.content,
      confidence: confidence ?? existing.confidence,
    });
    res.json({ data: updated });
  } catch (e) {
    logger.error('admin.memories.patch.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.delete('/memories/:key', async (req, res) => {
  try {
    const ok = await deleteEntity(req.params.key);
    if (!ok) return res.status(404).json({ error: 'not found' });
    res.json({ data: { deleted: true } });
  } catch (e) {
    logger.error('admin.memories.delete.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;