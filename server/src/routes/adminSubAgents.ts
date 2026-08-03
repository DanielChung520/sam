// Admin Sub-Agents endpoint — proxies to taskforge for plan listing + SSE

import { Router } from 'express';
import { logger } from '../agent/logger.js';

const router = Router();

const TASKFORGE_BASE = process.env.TASKFORGE_BASE_URL ?? 'http://localhost:9900';

interface TaskforgePlan {
  id?: string;
  type?: string;
  status?: string;
  title?: string;
  goal?: string;
  createdAt?: string;
  updatedAt?: string;
  progress?: number;
}

// GET /api/v1/admin/sub-agents — list all plans from taskforge
router.get('/sub-agents', async (_req, res) => {
  try {
    const r = await fetch(`${TASKFORGE_BASE}/v1/plans`);
    if (!r.ok) {
      return res.status(502).json({ error: `taskforge returned ${r.status}` });
    }
    const j = (await r.json()) as { plans?: TaskforgePlan[] };
    const plans: TaskforgePlan[] = (j.plans ?? []).map((p) => ({
      id: p.id,
      type: p.type,
      status: p.status,
      title: p.title,
      goal: p.goal,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      progress: p.progress ?? (p.status === 'completed' ? 100 : p.status === 'running' ? 50 : 0),
    }));
    res.json({ data: plans, count: plans.length });
  } catch (e) {
    logger.error('admin.subagents.list.failed', { error: String(e) });
    res.status(502).json({ error: 'taskforge unreachable', detail: String(e) });
  }
});

// GET /api/v1/admin/sub-agents/stream — SSE for plan updates
router.get('/sub-agents/stream', async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendPlans = async () => {
    try {
      const r = await fetch(`${TASKFORGE_BASE}/v1/plans`);
      if (!r.ok) return;
      const j = (await r.json()) as { plans?: TaskforgePlan[] };
      const plans = (j.plans ?? []).map((p) => ({
        id: p.id,
        type: p.type,
        status: p.status,
        title: p.title,
        goal: p.goal,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        progress: p.progress ?? (p.status === 'completed' ? 100 : p.status === 'running' ? 50 : 0),
      }));
      res.write(`data: ${JSON.stringify({ plans })}\n\n`);
    } catch {
      // ignore
    }
  };

  await sendPlans();
  const interval = setInterval(sendPlans, 15_000);
  _req.on('close', () => clearInterval(interval));
});

export default router;