// MCP client — 代理 taskforge MCP endpoint（JSON-RPC 2.0 over HTTP）
//
// 讓 sam server 可以列出並呼叫 taskforge 暴露的 MCP 工具
// （create_plan / get_plan / execute_plan / list_plans）

const TASKFORGE_BASE = process.env.TASKFORGE_BASE_URL || 'http://localhost:9900';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

let _toolsCache: McpTool[] | null = null;
let _toolsCacheAt = 0;
const TOOLS_CACHE_TTL_MS = 30_000;

async function rpcCall<T>(method: string, params: unknown = {}): Promise<T> {
  const res = await fetch(`${TASKFORGE_BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1e9),
      method,
      params,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP ${method}: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const j = (await res.json()) as { result?: { tools?: McpTool[] }; error?: { message?: string } };
  if (j.error) throw new Error(`MCP ${method}: ${j.error.message ?? 'rpc error'}`);
  return j.result as T;
}

export async function listMcpTools(force = false): Promise<McpTool[]> {
  const now = Date.now();
  if (!force && _toolsCache && now - _toolsCacheAt < TOOLS_CACHE_TTL_MS) {
    return _toolsCache;
  }
  const result = await rpcCall<{ tools: McpTool[] }>('list_tools');
  _toolsCache = result.tools ?? [];
  _toolsCacheAt = now;
  return _toolsCache;
}

export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await rpcCall<unknown>(name, args);
  return result;
}

export function invalidateMcpCache(): void {
  _toolsCache = null;
  _toolsCacheAt = 0;
}
