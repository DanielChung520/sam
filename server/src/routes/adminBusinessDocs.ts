// Business Doc CRUD (L3 Knowledge Base)
//
// 業務員管理產品 / 價目 / FAQ / 政策 / 菜單
//
// GET    /api/v1/admin/business-docs           — list（filter by channelId / type / enabled）
// GET    /api/v1/admin/business-docs/:key       — get single
// POST   /api/v1/admin/business-docs           — create（自動 sync Qdrant）
// PATCH  /api/v1/admin/business-docs/:key       — update（自動 sync Qdrant）
// DELETE /api/v1/admin/business-docs/:key       — delete（自動從 Qdrant 移除）

import { Router } from 'express';
import {
  upsertDoc,
  findDocById,
  listByChannel,
  deleteDoc,
  generateDocKey,
  type BusinessDoc,
  type BusinessDocType,
} from '../data/businessDocRepo.js';
import { ensureBusinessKBIndexes } from '../agent/contextRetriever.js';
import { logger } from '../agent/logger.js';

const router = Router();

router.get('/business-docs', async (req, res) => {
  try {
    const channelId = req.query.channelId as string | undefined;
    if (!channelId) return res.status(400).json({ error: 'channelId required' });
    const type = req.query.type as BusinessDocType | undefined;
    const enabledOnly = req.query.enabledOnly !== 'false';
    const docs = await listByChannel(channelId, { type, enabledOnly });
    res.json({ data: docs });
  } catch (e) {
    logger.error('admin.business_docs.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/business-docs/:key', async (req, res) => {
  try {
    const doc = await findDocById(req.params.key);
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json({ data: doc });
  } catch (e) {
    logger.error('admin.business_docs.get.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/business-docs', async (req, res) => {
  try {
    const { channelId, type, title, content, tags, enabled, slug } = req.body ?? {};
    if (!channelId || !type || !title || !content) {
      return res.status(400).json({ error: 'channelId, type, title, content required' });
    }
    const key = generateDocKey(channelId, slug ?? title);
    const doc: Omit<BusinessDoc, 'createdAt' | 'updatedAt'> = {
      _key: key,
      channelId,
      type,
      title,
      content,
      tags: Array.isArray(tags) ? tags : [],
      enabled: enabled !== false,
    };
    const saved = await upsertDoc(doc);
    await ensureBusinessKBIndexes(channelId);
    res.status(201).json({ data: saved });
  } catch (e) {
    logger.error('admin.business_docs.create.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.patch('/business-docs/:key', async (req, res) => {
  try {
    const existing = await findDocById(req.params.key);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { type, title, content, tags, enabled } = req.body ?? {};
    const updated = await upsertDoc({
      ...existing,
      type: type ?? existing.type,
      title: title ?? existing.title,
      content: content ?? existing.content,
      tags: Array.isArray(tags) ? tags : existing.tags,
      enabled: enabled ?? existing.enabled,
    });
    await ensureBusinessKBIndexes(updated.channelId);
    res.json({ data: updated });
  } catch (e) {
    logger.error('admin.business_docs.patch.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.delete('/business-docs/:key', async (req, res) => {
  try {
    const existing = await findDocById(req.params.key);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const ok = await deleteDoc(req.params.key);
    if (!ok) return res.status(500).json({ error: 'failed to delete' });
    res.json({ data: { deleted: true } });
  } catch (e) {
    logger.error('admin.business_docs.delete.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;