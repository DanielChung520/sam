// Admin Agent Center API — unified Agent + Sub-Agent management
// Single entry point that aggregates both:
//   - Main Agents (sam agents collection in ArangoDB)
//   - Sub-Agents (taskforge plans in Go service, port 9900)
//
// NOTE: Sub-Agent integration is stubbed in round 1 — returns [] until
// taskforge proxy is implemented in round 2.

import { Router } from 'express';
import { logger } from '../agent/logger.js';
import {
  listAgents,
  findAgentById,
  upsertAgent,
  deleteAgent,
  type Agent,
} from '../data/agentRepo.js';

const router = Router();

// ── Unified shape for list response ────────────────────────────────
// Frontend AgentCenter.tsx consumes this regardless of type.
export type AgentCenterItemType = 'main' | 'sub';

export interface AgentCenterItem {
  id: string;
  type: AgentCenterItemType;
  name: string;
  template: string;       // 功能性命名（取代 proper name）
  category: string;       // 'orchestrator' | 'planner' | 'reviewer' | 'memory' | 'consultant' | 'worker'
  description: string;
  enabled: boolean;
  status: string; // main: 'active'|'inactive'; sub: 'pending'|'running'|'completed'|'failed'
  persona: {
    archetype: string;
    role: string;
    traits: string[];
    myth: string;
  };
  createdAt: string;
  updatedAt: string;
  raw: any; // full data — frontend decides what to show in detail drawer
}

function toMainItem(a: Agent): AgentCenterItem {
  return {
    id: a._key,
    type: 'main',
    name: a.name,
    template: a.template ?? a.name,
    category: a.category,
    description: a.description ?? '',
    enabled: a.enabled ?? true,
    status: a.enabled ? 'active' : 'inactive',
    persona: {
      archetype: a.persona?.archetype ?? 'worker',
      role: a.persona?.role ?? '',
      traits: a.persona?.traits ?? [],
      myth: a.persona?.myth ?? '',
    },
    createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: a.updatedAt ? new Date(a.updatedAt).toISOString() : new Date().toISOString(),
    raw: a,
  };
}

function toSubItemStub(): AgentCenterItem[] {
  // Round 1 stub: no taskforge integration yet. Will proxy to
  // taskforge REST API at port 9900 in round 2.
  return [];
}

// ── GET /api/v1/admin/agent-center?type=all|main|sub ───────────────
router.get('/agent-center', async (req, res) => {
  try {
    const type = (req.query.type as string) ?? 'all';
    const items: AgentCenterItem[] = [];

    if (type === 'all' || type === 'main') {
      const agents = await listAgents();
      items.push(...agents.map(toMainItem));
    }

    if (type === 'all' || type === 'sub') {
      const subs = toSubItemStub();
      items.push(...subs);
    }

    // Newest first
    items.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

    res.json({ data: items });
  } catch (e) {
    logger.error('admin.agent-center.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// ── GET /api/v1/admin/agent-center/:type/:id ───────────────────────
router.get('/agent-center/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type === 'main') {
      const a = await findAgentById(id);
      if (!a) return res.status(404).json({ error: 'main agent not found' });
      return res.json({ data: toMainItem(a) });
    }
    if (type === 'sub') {
      return res.status(501).json({ error: 'sub-agent detail endpoint pending taskforge integration (round 2)' });
    }
    return res.status(400).json({ error: `unknown agent type: ${type}` });
  } catch (e) {
    logger.error('admin.agent-center.get.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// ── POST /api/v1/admin/agent-center/main ───────────────────────────
router.post('/agent-center/main', async (req, res) => {
  try {
    const { name, description, systemPrompt, model } = req.body ?? {};
    if (!name) return res.status(400).json({ error: 'name required' });

    const key = `agent_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const agent: Omit<Agent, 'webhookPath' | 'createdAt' | 'updatedAt'> = {
      _key: key,
      name,
      template: name,
      description: description ?? '',
      category: 'worker',
      enabled: true,
      persona: { archetype: 'worker', role: '', traits: [], myth: '' },
      systemPrompt: systemPrompt ?? '你是一個專業的 LINE OMO 業務助理。',
      model: model ?? 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000,
      personToken: '',
      prompts: { main: systemPrompt ?? '你是一個專業的 LINE OMO 業務助理。' },
      enabledSkills: [],
      enabledMcpTools: [],
      enabledSubAgents: [],
      intentConfidenceThreshold: 0.5,
      maxClarificationRounds: 2,
      enableQualityCheck: false,
      conversationTtl: 1800,
      historyLimit: 20,
      maxMessagesPerDay: 1000,
      cooldownSeconds: 0,
      autoReplyEnabled: false,
      autoReplyMessage: '目前不在服務時間，我們將在營業時間盡快回覆您！',
    };

    const saved = await upsertAgent(agent);
    res.status(201).json({ data: toMainItem(saved) });
  } catch (e) {
    logger.error('admin.agent-center.main.create.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// ── PATCH /api/v1/admin/agent-center/main/:id ──────────────────────
router.patch('/agent-center/main/:id', async (req, res) => {
  try {
    const existing = await findAgentById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'main agent not found' });

    const { name, description, enabled, systemPrompt, model, temperature, maxTokens,
            personToken, maxMessagesPerDay, cooldownSeconds,
            autoReplyEnabled, autoReplyMessage,
            template, category, persona, prompts, enabledSkills, enabledMcpTools,
            enabledSubAgents, intentConfidenceThreshold, maxClarificationRounds,
            enableQualityCheck, conversationTtl, historyLimit,
            slashCommands, routing } = req.body ?? {};

    const updated = await upsertAgent({
      _key: existing._key,
      name: name ?? existing.name,
      template: template ?? existing.template,
      description: description ?? existing.description,
      category: category ?? existing.category,
      enabled: enabled ?? existing.enabled,
      persona: persona ?? existing.persona,
      systemPrompt: systemPrompt ?? existing.systemPrompt,
      model: model ?? existing.model,
      temperature: temperature ?? existing.temperature,
      maxTokens: maxTokens ?? existing.maxTokens,
      personToken: personToken ?? existing.personToken,
      prompts: prompts ?? existing.prompts,
      enabledSkills: enabledSkills ?? existing.enabledSkills,
      enabledMcpTools: enabledMcpTools ?? existing.enabledMcpTools,
      enabledSubAgents: enabledSubAgents ?? existing.enabledSubAgents,
      intentConfidenceThreshold: intentConfidenceThreshold ?? existing.intentConfidenceThreshold,
      maxClarificationRounds: maxClarificationRounds ?? existing.maxClarificationRounds,
      enableQualityCheck: enableQualityCheck ?? existing.enableQualityCheck,
      conversationTtl: conversationTtl ?? existing.conversationTtl,
      historyLimit: historyLimit ?? existing.historyLimit,
      maxMessagesPerDay: maxMessagesPerDay ?? existing.maxMessagesPerDay,
      cooldownSeconds: cooldownSeconds ?? existing.cooldownSeconds,
      autoReplyEnabled: autoReplyEnabled ?? existing.autoReplyEnabled,
      autoReplyMessage: autoReplyMessage ?? existing.autoReplyMessage,
      slashCommands: slashCommands ?? existing.slashCommands,
      routing: routing ?? existing.routing,
    });

    res.json({ data: toMainItem(updated) });
  } catch (e) {
    logger.error('admin.agent-center.main.patch.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// ── DELETE /api/v1/admin/agent-center/main/:id ─────────────────────
router.delete('/agent-center/main/:id', async (req, res) => {
  try {
    const ok = await deleteAgent(req.params.id);
    if (!ok) return res.status(404).json({ error: 'main agent not found' });
    res.json({ data: { deleted: true } });
  } catch (e) {
    logger.error('admin.agent-center.main.delete.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// ── Sub-Agent stubs (round 2 will replace with taskforge proxy) ────
router.post('/agent-center/sub', (_req, res) => {
  res.status(501).json({ error: 'sub-agent create endpoint pending taskforge integration (round 2)' });
});
router.patch('/agent-center/sub/:id', (_req, res) => {
  res.status(501).json({ error: 'sub-agent update endpoint pending taskforge integration (round 2)' });
});
router.delete('/agent-center/sub/:id', (_req, res) => {
  res.status(501).json({ error: 'sub-agent delete endpoint pending taskforge integration (round 2)' });
});

router.get('/agent-center/stats', async (_req, res) => {
  try {
    const { getDelegationStats } = await import('../agent/agentDelegation.js');
    const stats = getDelegationStats();
    const out: Record<string, { lastCalled: number; callCount: number }> = {};
    for (const [name, s] of stats.entries()) {
      out[name] = s;
    }
    res.json({ data: out });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;