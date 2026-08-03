// Admin Accounts API — business account CRUD

import { Router } from 'express';
import { logger } from '../agent/logger.js';
import { listAccounts, findAccountById, upsertAccount, deleteAccount } from '../data/accountRepo.js';

const router = Router();

router.get('/accounts', async (_req, res) => {
  try {
    const accounts = await listAccounts();
    res.json({ data: accounts });
  } catch (e) {
    logger.error('admin.accounts.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/accounts/:id', async (req, res) => {
  try {
    const account = await findAccountById(req.params.id);
    if (!account) return res.status(404).json({ error: 'account not found' });
    res.json({ data: account });
  } catch (e) {
    logger.error('admin.accounts.get.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/accounts', async (req, res) => {
  try {
    const { name, email, businessOwnerId } = req.body ?? {};
    if (!name || !businessOwnerId) return res.status(400).json({ error: 'name and businessOwnerId required' });
    const account = await upsertAccount({
      _key: businessOwnerId,
      name,
      email: email ?? '',
      businessOwnerId,
      channelIds: [],
      enabled: true,
      source: 'admin',
    });
    res.status(201).json({ data: account });
  } catch (e) {
    logger.error('admin.accounts.create.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.patch('/accounts/:id', async (req, res) => {
  try {
    const existing = await findAccountById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'account not found' });
    const { name, email, channelIds, enabled } = req.body ?? {};
    const updated = await upsertAccount({
      _key: existing._key,
      name: name ?? existing.name,
      email: email ?? existing.email,
      businessOwnerId: existing.businessOwnerId,
      channelIds: channelIds ?? existing.channelIds,
      enabled: enabled ?? existing.enabled,
      source: existing.source,
    });
    res.json({ data: updated });
  } catch (e) {
    logger.error('admin.accounts.patch.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const ok = await deleteAccount(req.params.id);
    if (!ok) return res.status(404).json({ error: 'account not found' });
    res.json({ data: { deleted: true } });
  } catch (e) {
    logger.error('admin.accounts.delete.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;
