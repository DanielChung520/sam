// Flow Runner — 流程執行器（真實執行）
//
// 讀 skill_flows collection 的節點流程依序執行。process-skill 的能力完全依賴此執行器。
//
// 支援節點型別：
//   trigger:   標記流程入口（無副作用）
//   skill:     呼叫對應 skill（executor 可能是 inline/taskforge/process/script）
//   condition: 依 context[field] 判斷（operator + value），跳轉 onTrue/onFalse 節點
//   llm:       呼叫 LLM（chatCompletion），輸出寫入 context[nodeId]，可改寫用 systemPrompt
//   function:  vm sandbox 執行 node.config.code（白名單：args/callSkill/log）
//   storage:   寫入 ArangoDB collection（支援 channelId 隔離 + template 插值）
//   memory:    記憶寫入（簡化為 storage to memories collection）
//   reply:     回覆文字（${key} 模板插值），流程結束
//   dummy:     標記節點，無副作用

import { getDb, ensureCollection } from '../data/arango.js';
import { getSkillRegistry } from './skillRegistry.js';
import { getSkillExecutor, interpolate } from './skillExecutor.js';
import { chatCompletion } from './llmClient.js';
import { logger } from './logger.js';
import vm from 'node:vm';
import type { Conversation } from './types.js';

const FLOW_COLLECTION = 'skill_flows';
const FUNCTION_TIMEOUT_MS = 10_000;

interface FlowNode {
  id?: string;
  type?: string;
  label?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface FlowRunOptions {
  flowId: string;
  args?: Record<string, unknown>;
  conversation?: Conversation;
}

export interface FlowRunResult {
  ok: boolean;
  output: string;
  path?: string[];
  context?: Record<string, unknown>;
  error?: string;
}

async function loadFlow(flowId: string): Promise<FlowNode[]> {
  try {
    await ensureCollection(FLOW_COLLECTION);
    const db = getDb();
    const key = Buffer.from(flowId, 'utf8').toString('base64url');
    const doc = (await db.collection(FLOW_COLLECTION).document(key).catch(() => null)) as
      | { nodes?: FlowNode[] }
      | null;
    return (doc?.nodes ?? []).filter((n) => n?.enabled !== false);
  } catch (e) {
    logger.debug('flowRunner.load_failed', { flowId, error: String(e) });
    return [];
  }
}

// expression 評估（condition / storage 等用）— 沙箱化限定字串比對/含值
function evaluate(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'eq': return String(actual) === String(expected);
    case 'ne': return String(actual) !== String(expected);
    case 'contains': return String(actual).includes(String(expected));
    case 'notContains': return !String(actual).includes(String(expected));
    case 'empty': return actual === undefined || actual === null || actual === '';
    case 'notEmpty': return actual !== undefined && actual !== null && actual !== '';
    default: return String(actual) === String(expected);
  }
}

// 解析 expression 為簡易 {field} op value 形式（向後相容）
function evalExpression(expression: string, context: Record<string, unknown>): boolean {
  // 極簡版：支援 `field op value`，如 `type in ['x','y'] && content 非空` 直接回 true（向後相容）
  // 真實表達式解析留待後續（避免 LLM/sandbox 開銷）
  if (!expression) return true;
  // 檢查常見關鍵字
  const m = expression.match(/^(\S+)\s+(eq|ne|contains|notContains|empty|notEmpty)\s+(.+)$/i);
  if (m) {
    return evaluate(context[m[1]], m[2].toLowerCase(), m[3].replace(/^['"]|['"]$/g, ''));
  }
  return true; // 無法解析 → 通過（保守）
}

// LLM 節點執行
async function runLlmNode(cfg: Record<string, unknown>, context: Record<string, unknown>): Promise<string> {
  const model = (cfg.model as string) || '';
  const systemPrompt = (cfg.systemPrompt as string) || '';
  const rawPrompt = (cfg.prompt as string) || (cfg.userPrompt as string) || '';
  // 若節點未指定 user prompt，預設用整個 context（讓 LLM 看到輸入資料）
  const userPrompt = rawPrompt.trim()
    ? interpolate(rawPrompt, context)
    : JSON.stringify(context, null, 2);
  const temperature = typeof cfg.temperature === 'number' ? cfg.temperature : 0.7;
  const maxTokens = typeof cfg.maxTokens === 'number' ? cfg.maxTokens : 512;
  const timeoutMs = typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : 30_000;

  // 從 flowConfig（skill_flows 節點 config）讀 model/apiBase/apiKey（覆蓋 env）
  const flowConfig: Record<string, unknown> = {};
  for (const k of ['apiBase', 'apiKey', 'model']) {
    const v = cfg[k];
    if (typeof v === 'string' && v.trim() && v.trim() !== 'dllm 預設') {
      flowConfig[k] = v.trim();
    }
  }

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const res = await chatCompletion({
    messages,
    temperature,
    maxTokens,
    timeoutMs,
  });
  return res.content.trim();
}

// function 節點執行（vm sandbox 白名單：args/callSkill/log/context）
async function runFunctionNode(cfg: Record<string, unknown>, context: Record<string, unknown>): Promise<unknown> {
  const code = (cfg.code as string) || '';
  if (!code.trim()) return undefined;
  const timeoutMs = typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : FUNCTION_TIMEOUT_MS;

  const sandboxLogs: string[] = [];
  const sandbox: Record<string, unknown> = {
    args: { ...context },
    context: { ...context },
    log: (...xs: unknown[]) => sandboxLogs.push(xs.map(String).join(' ')),
    callSkill: async (skillId: string, skillArgs: Record<string, unknown> = {}) => {
      const registry = await getSkillRegistry();
      const skill = registry.get(skillId);
      if (!skill) throw new Error(`skill not found: ${skillId}`);
      const executor = getSkillExecutor();
      const conv = defaultConversation();
      const r = await executor.execute(skill, { ...context, ...skillArgs }, conv);
      return r.output;
    },
  };
  const vmContext = vm.createContext(sandbox);
  const wrapped = `(async () => { ${code}\n})()`;
  const result = await vm.runInContext(wrapped, vmContext, { timeout: timeoutMs });
  return result ?? sandboxLogs.join('\n');
}

// storage 節點執行（寫入 ArangoDB collection，支援 template 插值 + 隔離）
async function runStorageNode(cfg: Record<string, unknown>, context: Record<string, unknown>): Promise<unknown> {
  const collection = (cfg.collection as string) || '';
  if (!collection) return undefined;
  const fields = (cfg.fields as Record<string, string>) || {};
  const accountIsolation = cfg.accountIsolation !== false;

  const db = getDb();
  await ensureCollection(collection);

  // 解析 fields（template 插值）
  const doc: Record<string, unknown> = {};
  for (const [key, template] of Object.entries(fields)) {
    doc[key] = interpolate(template, context);
  }

  // 隔離欄位
  if (accountIsolation) {
    if (context.userAccount || context.userId) {
      doc.userAccount = doc.userAccount || context.userAccount || context.userId;
    }
    if (context.channelId || context.businessOwnerId) {
      doc.channelId = doc.channelId || context.channelId || context.businessOwnerId;
    }
  }
  doc.createdAt = Date.now();

  const saved = await db.collection(collection).save(doc);
  return saved;
}

export async function runFlow(options: FlowRunOptions): Promise<FlowRunResult> {
  const { flowId, args = {}, conversation } = options;
  const nodes = await loadFlow(flowId);
  if (nodes.length === 0) {
    return { ok: false, output: '', error: `flow not found: ${flowId}` };
  }

  const context: Record<string, unknown> = { ...args };
  const path: string[] = [];
  const registry = await getSkillRegistry();
  const executor = getSkillExecutor();
  const byId = new Map<string, FlowNode>(nodes.filter((n) => n.id).map((n) => [n.id!, n]));

  let i = 0;
  const maxSteps = nodes.length * 20; // 防止無限跳轉
  let steps = 0;

  while (i < nodes.length && steps < maxSteps) {
    steps += 1;
    const node = nodes[i];
    const type = node.type ?? 'dummy';
    path.push(node.label ?? type);
    const cfg = node.config ?? {};

    if (type === 'trigger' || type === 'dummy') {
      // 入口標記，無副作用
    } else if (type === 'skill') {
      const skillId = (cfg.skillId as string) ?? (cfg.target as string);
      if (skillId) {
        const skill = registry.get(skillId);
        if (skill) {
          try {
            const conv = conversation ?? defaultConversation();
            const result = await executor.execute(skill, { ...args, ...context }, conv);
            const key = node.id ?? skillId;
            context[key] = result.output;
            context[skillId] = result.output;
          } catch (e) {
            logger.warn('flowRunner.skill_failed', { flowId, skillId, error: String(e) });
            context[node.id ?? skillId] = '';
          }
        }
      }
    } else if (type === 'condition') {
      // 向後相容：同時支援 {field, operator, value} 與 {expression}
      let hit: boolean;
      if (typeof cfg.field === 'string') {
        hit = evaluate(context[cfg.field], (cfg.operator as string) ?? 'eq', cfg.value);
      } else {
        hit = evalExpression((cfg.expression as string) || '', context);
      }
      const targetId = hit
        ? (cfg.onTrue as string)
        : (cfg.onFalse as string);
      if (targetId && byId.has(targetId)) {
        i = nodes.findIndex((n) => n.id === targetId);
        continue;
      }
      if (!hit) {
        // false 分支無指定 → 結束
        break;
      }
      // true 分支無指定 → 繼續下一節點
    } else if (type === 'llm') {
      const idKey = node.id ?? `llm_${i}`;
      // 向後相容：同時寫入 llm_output key（給舊模板 {llm_output} 使用）
      const legacyKey = 'llm_output';
      try {
        const out = await runLlmNode(cfg, context);
        context[idKey] = out;
        context[legacyKey] = out;
      } catch (e) {
        logger.warn('flowRunner.llm_failed', { flowId, error: String(e) });
        context[idKey] = '';
        context[legacyKey] = '';
      }
    } else if (type === 'function') {
      const key = node.id ?? `func_${i}`;
      try {
        const out = await runFunctionNode(cfg, context);
        context[key] = out;
      } catch (e) {
        logger.warn('flowRunner.function_failed', { flowId, error: String(e) });
        context[key] = '';
      }
    } else if (type === 'storage' || type === 'memory') {
      const key = node.id ?? `storage_${i}`;
      try {
        const out = await runStorageNode(
          { ...cfg, collection: cfg.collection ?? (type === 'memory' ? 'memories' : undefined) },
          context,
        );
        context[key] = out;
      } catch (e) {
        logger.warn('flowRunner.storage_failed', { flowId, error: String(e) });
        context[key] = '';
      }
    } else if (type === 'reply') {
      const text = (cfg.text as string) ?? (cfg.template as string) ?? '';
      return { ok: true, output: interpolate(text, context), path, context };
    } else {
      logger.warn('flowRunner.unknown_node_type', { flowId, type });
    }

    i += 1;
  }

  // 沒有 reply 節點 → 組裝所有 skill/llm 輸出
  const outputs: string[] = [];
  for (const n of nodes) {
    if (n.type !== 'skill' && n.type !== 'llm') continue;
    const key = n.id;
    if (key && context[key]) outputs.push(String(context[key]));
  }
  return {
    ok: outputs.length > 0,
    output: outputs.join('\n\n'),
    path,
    context,
  };
}

function defaultConversation(): Conversation {
  const now = Date.now();
  return {
    id: `flow_${now}`,
    channelId: '',
    userId: '',
    state: 'idle',
    history: [],
    context: {},
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 1800000,
  };
}