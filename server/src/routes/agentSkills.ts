// Agent Skills API — list/get/enable/disable

import { Router } from 'express';
import { logger } from '../agent/logger.js';
import { getSkillRegistry } from '../agent/skillRegistry.js';
import { getSkillExecutor } from '../agent/skillExecutor.js';
import type { Conversation, SkillManifest } from '../agent/types.js';

const router = Router();

interface SkillDto {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  enabled: boolean;
  executorType: 'inline' | 'taskforge' | 'http';
  parameters: Array<{ name: string; type: string; required: boolean; description: string }>;
  timeoutMs?: number;
}

function toDto(s: SkillManifest): SkillDto {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    triggers: s.triggers,
    enabled: s.enabled !== false,
    executorType: s.executor.type,
    parameters: s.parameters.map((p) => ({
      name: p.name,
      type: p.type,
      required: p.required,
      description: p.description,
    })),
    timeoutMs: s.timeoutMs,
  };
}

router.get('/skills', async (_req, res) => {
  try {
    const registry = await getSkillRegistry();
    res.json({
      data: registry.list().map(toDto),
      count: registry.list().length,
    });
  } catch (e) {
    logger.error('agent.skills.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/skills/:id', async (req, res) => {
  try {
    const registry = await getSkillRegistry();
    const skill = registry.get(req.params.id);
    if (!skill) {
      return res.status(404).json({ error: 'skill not found' });
    }
    res.json({ data: toDto(skill) });
  } catch (e) {
    logger.error('agent.skills.get.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.patch('/skills/:id', async (req, res) => {
  try {
    const registry = await getSkillRegistry();
    const skill = registry.get(req.params.id);
    if (!skill) {
      return res.status(404).json({ error: 'skill not found' });
    }
    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'body.enabled (boolean) required' });
    }
    const ok = registry.setEnabled(req.params.id, enabled);
    if (!ok) {
      return res.status(404).json({ error: 'skill not found' });
    }
    logger.info('agent.skills.toggled', { skillId: req.params.id, enabled });
    const updated = registry.get(req.params.id);
    res.json({ data: toDto(updated!) });
  } catch (e) {
    logger.error('agent.skills.patch.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/skills/:id/test', async (req, res) => {
  try {
    const registry = await getSkillRegistry();
    const skill = registry.get(req.params.id);
    if (!skill) {
      return res.status(404).json({ error: 'skill not found' });
    }

    const args: Record<string, unknown> = req.body?.args ?? {};
    const executor = getSkillExecutor();

    const testConversation: Conversation = {
      id: 'test-session',
      userId: 'admin-test',
      channelId: 'admin',
      state: 'idle',
      history: [],
      context: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 300_000,
    };

    const result = await executor.execute(skill, args, testConversation);
    res.json({ data: { result, manifest: toDto(skill) } });
  } catch (e) {
    logger.error('agent.skills.test.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;