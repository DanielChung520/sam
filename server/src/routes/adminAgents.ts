// Admin Agents API — Agent CRUD

import { Router } from 'express';
import { logger } from '../agent/logger.js';
import { listAgents, findAgentById, upsertAgent, deleteAgent, type Agent } from '../data/agentRepo.js';

const router = Router();

// GET /api/v1/admin/agents
router.get('/agents', async (_req, res) => {
  try {
    const agents = await listAgents();
    res.json({ data: agents });
  } catch (e) {
    logger.error('admin.agents.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// GET /api/v1/admin/agents/:id
router.get('/agents/:id', async (req, res) => {
  try {
    const agent = await findAgentById(req.params.id);
    if (!agent) return res.status(404).json({ error: 'agent not found' });
    res.json({ data: agent });
  } catch (e) {
    logger.error('admin.agents.get.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// POST /api/v1/admin/agents
router.post('/agents', async (req, res) => {
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
    res.status(201).json({ data: saved });
  } catch (e) {
    logger.error('admin.agents.create.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// PATCH /api/v1/admin/agents/:id
router.patch('/agents/:id', async (req, res) => {
  try {
    const existing = await findAgentById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'agent not found' });

    const { name, description, enabled, systemPrompt, model, temperature, maxTokens,
            personToken, maxMessagesPerDay, cooldownSeconds,
            autoReplyEnabled, autoReplyMessage,
            template, category, persona, prompts, enabledSkills, enabledMcpTools,
            enabledSubAgents, intentConfidenceThreshold, maxClarificationRounds,
            enableQualityCheck, conversationTtl, historyLimit } = req.body ?? {};

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
    });

    res.json({ data: updated });
  } catch (e) {
    logger.error('admin.agents.patch.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// DELETE /api/v1/admin/agents/:id
router.delete('/agents/:id', async (req, res) => {
  try {
    const ok = await deleteAgent(req.params.id);
    if (!ok) return res.status(404).json({ error: 'agent not found' });
    res.json({ data: { deleted: true } });
  } catch (e) {
    logger.error('admin.agents.delete.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;
