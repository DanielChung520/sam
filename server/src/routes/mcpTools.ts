// MCP Tools API — 代理 taskforge MCP endpoint
// GET  /mcp/tools          → 列出可用 MCP 工具
// POST /mcp/tools/:name    → 呼叫指定 MCP 工具

import { Router } from 'express';
import { listMcpTools, callMcpTool, invalidateMcpCache } from '../agent/mcpClient.js';

const router = Router();

router.get('/mcp/tools', async (_req, res) => {
  try {
    const tools = await listMcpTools();
    res.json({ data: tools, total: tools.length });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

router.post('/mcp/tools/refresh', async (_req, res) => {
  invalidateMcpCache();
  try {
    const tools = await listMcpTools(true);
    res.json({ data: tools, total: tools.length });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

router.post('/mcp/tools/:name', async (req, res) => {
  const name = req.params.name;
  const args = (req.body ?? {}) as Record<string, unknown>;
  try {
    const result = await callMcpTool(name, args);
    res.json({ data: result });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

export default router;
