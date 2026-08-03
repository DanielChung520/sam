// Admin metrics endpoint
//
// 彙總 channels / skills / sub-agents 統計 + 24h 訊息量 + top skills + 最近錯誤。

import { Router } from 'express';
import { logger } from '../agent/logger.js';
import { Metrics } from '../lib/metrics.js';
import { getSkillRegistry } from '../agent/skillRegistry.js';
import { listAllChannels } from '../data/channelRepo.js';

const router = Router();

interface MetricsResponse {
  channels: { total: number; active: number };
  skills: { total: number; enabled: number };
  subAgents: { active: number };
  messages24h: Array<{ hour: string; count: number }>;
  topSkills: Array<{ skillId: string; calls: number }>;
  recentErrors: Array<{ ts: string; scope: string; message: string; context?: string }>;
  generatedAt: string;
}

router.get('/metrics', async (_req, res) => {
  try {
    const [channelsList, messages24h, topSkills, recentErrors, registry] = await Promise.all([
      listAllChannels().catch(() => []),
      Metrics.getMessages24h(),
      Metrics.getTopSkills(10),
      Metrics.getRecentErrors(10),
      getSkillRegistry(),
    ]);

    const skills = registry.list();

    let activeSubAgents = 0;
    try {
      const baseUrl = process.env.TASKFORGE_BASE_URL ?? 'http://localhost:9900';
      const r = await fetch(`${baseUrl}/v1/plans`);
      if (r.ok) {
        const j = (await r.json()) as { plans?: Array<{ status?: string }> };
        activeSubAgents = (j.plans ?? []).filter((p) => p.status === 'pending' || p.status === 'running').length;
      }
    } catch (e) {
      logger.warn('admin.metrics.taskforge_unreachable', { error: String(e) });
    }

    const response: MetricsResponse = {
      channels: {
        total: channelsList.length,
        active: channelsList.filter((c) => c.enabled).length,
      },
      skills: {
        total: skills.length,
        enabled: skills.filter((s) => s.enabled !== false).length,
      },
      subAgents: { active: activeSubAgents },
      messages24h,
      topSkills,
      recentErrors,
      generatedAt: new Date().toISOString(),
    };
    res.json({ data: response });
  } catch (e) {
    logger.error('admin.metrics.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/metrics/stream', async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendSnapshot = async () => {
    try {
      const channelsList = await listAllChannels().catch(() => []);
      const messages24h = await Metrics.getMessages24h();
      const topSkills = await Metrics.getTopSkills(10);
      const recentErrors = await Metrics.getRecentErrors(10);
      const registry = await getSkillRegistry();

      let activeSubAgents = 0;
      try {
        const baseUrl = process.env.TASKFORGE_BASE_URL ?? 'http://localhost:9900';
        const r = await fetch(`${baseUrl}/v1/plans`);
        if (r.ok) {
          const j = (await r.json()) as { plans?: Array<{ status?: string }> };
          activeSubAgents = (j.plans ?? []).filter((p) => p.status === 'pending' || p.status === 'running').length;
        }
      } catch {
        // ignore
      }

      const payload = {
        channels: { total: channelsList.length, active: channelsList.filter((c) => c.enabled).length },
        skills: { total: registry.list().length, enabled: registry.list().filter((s) => s.enabled !== false).length },
        subAgents: { active: activeSubAgents },
        messages24h,
        topSkills,
        recentErrors,
        generatedAt: new Date().toISOString(),
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // ignore snapshot failure
    }
  };

  await sendSnapshot();
  const interval = setInterval(sendSnapshot, 60_000);
  _req.on('close', () => clearInterval(interval));
});

export default router;