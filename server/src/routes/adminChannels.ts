// Admin Channels CRUD API

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../agent/logger.js';
import {
  listAllChannels,
  findChannelById,
  upsertChannel,
  setChannelEnabled,
  deleteChannel,
  type Channel,
} from '../data/channelRepo.js';
import { findAgentById } from '../data/agentRepo.js';
import { BASE_SKILLS } from '../agent/slashMenu.js';

const router = Router();

interface ChannelDto {
  id: string;
  name: string;
  channelId: string;
  destination?: string;
  businessOwnerId: string;
  enabled: boolean;
  permissions?: string[];
  inheritedPermissions?: string[];  // linkedAgent + authorizedAgents 白名單合併
  authorizedAgents?: string[];
  pushEnabled?: boolean;
  ackEnabled?: boolean;
  ackMessage?: string;
  concurrencyLimit?: number;
  queuePriority?: number;
  status: 'connected' | 'pending' | 'error' | 'disabled';
  createdAt: number;
  updatedAt: number;
}

async function toDto(c: Channel): Promise<ChannelDto & { linkedAgentKey: string; authorizedAgents?: string[] }> {
  const agentKeys = [c.linkedAgentKey, ...(c.authorizedAgents ?? [])].filter(Boolean);
  const inheritedSet = new Set<string>();
  for (const key of agentKeys) {
    const agent = await findAgentById(key).catch(() => null);
    if (agent) {
      for (const s of agent.enabledSkills ?? []) if (!BASE_SKILLS.has(s)) inheritedSet.add(s);
      for (const s of agent.enabledSubAgents ?? []) inheritedSet.add(s);
      for (const s of agent.enabledMcpTools ?? []) inheritedSet.add(s);
    }
  }
  return {
    id: c._key,
    name: c.name,
    channelId: c.channelId,
    destination: c.destination,
    businessOwnerId: c.businessOwnerId,
    enabled: c.enabled,
    permissions: c.permissions,
    inheritedPermissions: inheritedSet.size > 0 ? Array.from(inheritedSet) : undefined,
    status: c.enabled ? 'connected' : 'disabled',
    linkedAgentKey: c.linkedAgentKey,
    authorizedAgents: c.authorizedAgents,
    pushEnabled: c.pushEnabled ?? true,
    ackEnabled: c.ackEnabled ?? true,
    ackMessage: c.ackMessage ?? '',
    concurrencyLimit: c.concurrencyLimit ?? 2,
    queuePriority: c.queuePriority ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

async function verifyLineToken(accessToken: string): Promise<{ ok: boolean; info?: any; error?: string }> {
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `LINE API ${res.status}: ${text.slice(0, 150)}` };
    }
    const info = await res.json();
    return { ok: true, info };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// GET /api/v1/admin/channels
router.get('/channels', async (_req, res) => {
  try {
    const channels = await listAllChannels();
    res.json({ data: await Promise.all(channels.map((c) => toDto(c))) });
  } catch (e) {
    logger.error('admin.channels.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// GET /api/v1/admin/channels/:id
router.get('/channels/:id', async (req, res) => {
  try {
    const channel = await findChannelById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'channel not found' });
    res.json({ data: await toDto(channel) });
  } catch (e) {
    logger.error('admin.channels.get.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// POST /api/v1/admin/channels
router.post('/channels', async (req, res) => {
  try {
    const { channelId, name, channelSecret, accessToken, businessOwnerId, linkedAgentKey, authorizedAgents, destination, permissions, pushEnabled, ackEnabled, ackMessage, concurrencyLimit, queuePriority } = req.body ?? {};
    if (!channelId || !name) {
      return res.status(400).json({ error: 'channelId and name required' });
    }
    const channel: Omit<Channel, 'createdAt' | 'updatedAt'> = {
      _key: randomUUID(),
      channelId,
      businessOwnerId: businessOwnerId ?? 'admin',
      name,
      channelSecret: channelSecret ?? '',
      accessToken: accessToken ?? '',
      destination: destination ?? '',
      permissions: Array.isArray(permissions) ? permissions : undefined,
      authorizedAgents: Array.isArray(authorizedAgents) ? authorizedAgents : undefined,
      pushEnabled: typeof pushEnabled === 'boolean' ? pushEnabled : true,
      ackEnabled: typeof ackEnabled === 'boolean' ? ackEnabled : true,
      ackMessage: ackMessage ?? '',
      concurrencyLimit: typeof concurrencyLimit === 'number' ? concurrencyLimit : 2,
      queuePriority: typeof queuePriority === 'number' ? queuePriority : 0,
      enabled: true,
      linkedAgentKey: linkedAgentKey ?? '',
    };
    const saved = await upsertChannel(channel);
    res.status(201).json({ data: await toDto(saved) });
  } catch (e) {
    logger.error('admin.channels.create.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// PATCH /api/v1/admin/channels/:id
router.patch('/channels/:id', async (req, res) => {
  try {
    const existing = await findChannelById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'channel not found' });

    const { name, channelSecret, accessToken, enabled, linkedAgentKey, authorizedAgents, destination, permissions, pushEnabled, ackEnabled, ackMessage, concurrencyLimit, queuePriority } = req.body ?? {};
    const updated = await upsertChannel({
      _key: existing._key,
      channelId: existing.channelId,
      businessOwnerId: existing.businessOwnerId,
      name: name ?? existing.name,
      channelSecret: channelSecret ?? existing.channelSecret,
      accessToken: accessToken ?? existing.accessToken,
      destination: destination ?? existing.destination,
      permissions: Array.isArray(permissions) ? permissions : existing.permissions,
      authorizedAgents: Array.isArray(authorizedAgents) ? authorizedAgents : existing.authorizedAgents,
      pushEnabled: typeof pushEnabled === 'boolean' ? pushEnabled : existing.pushEnabled,
      ackEnabled: typeof ackEnabled === 'boolean' ? ackEnabled : existing.ackEnabled,
      ackMessage: ackMessage ?? existing.ackMessage,
      concurrencyLimit: typeof concurrencyLimit === 'number' ? concurrencyLimit : existing.concurrencyLimit,
      queuePriority: typeof queuePriority === 'number' ? queuePriority : existing.queuePriority,
      enabled: enabled ?? existing.enabled,
      linkedAgentKey: linkedAgentKey ?? existing.linkedAgentKey,
    });
    res.json({ data: await toDto(updated) });
  } catch (e) {
    logger.error('admin.channels.patch.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// POST /api/v1/admin/channels/:id/test — 驗證 token 有效性
router.post('/channels/:id/test', async (req, res) => {
  try {
    const channel = await findChannelById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'channel not found' });
    if (!channel.accessToken) {
      return res.status(400).json({ ok: false, error: 'channel has no access token' });
    }
    const result = await verifyLineToken(channel.accessToken);
    res.json(result);
  } catch (e) {
    logger.error('admin.channels.test.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// GET /api/v1/admin/channels/:id/verify — 查 LINE 官方 channel 資訊
router.get('/channels/:id/verify', async (req, res) => {
  try {
    const channel = await findChannelById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'channel not found' });
    const result = await verifyLineToken(channel.accessToken);
    if (result.ok) {
      return res.json({
        ok: true,
        data: result.info,
        destination: channel.destination,
      });
    }
    res.status(502).json({ ok: false, error: result.error });
  } catch (e) {
    logger.error('admin.channels.verify.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// DELETE /api/v1/admin/channels/:id
router.delete('/channels/:id', async (req, res) => {
  try {
    const ok = await deleteChannel(req.params.id);
    if (!ok) return res.status(404).json({ error: 'channel not found' });
    res.json({ data: { deleted: true } });
  } catch (e) {
    logger.error('admin.channels.delete.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;