// Flow Runner — 精簡流程執行器
//
// 讀 skill_flows collection 的節點流程依序執行，作為意圖規則的「script 行為」。
// 支援節點型別（精簡版）：
//   - skill:     呼叫對應 skill（依 config.skillId），輸出寫入 context[skillId]
//   - condition: 依 config.field / config.operator / config.value 判斷，走 onTrue/onFalse 分支
//   - reply:     回覆文字（可模板插值 {key}），流程結束
//
// 範例流程（image-router）：
//   skill:ocr → condition: type==名片 → skill:card-collection → reply
//                        └→ type==問候 → greeting 流程 → reply
//                        └→ 其他 → reply

import { getDb, ensureCollection } from '../data/arango.js';
import { getSkillRegistry } from './skillRegistry.js';
import { getSkillExecutor } from './skillExecutor.js';
import { logger } from './logger.js';
import { interpolate } from './skillExecutor.js';
import type { Conversation } from './types.js';

const FLOW_COLLECTION = 'skill_flows';

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
  path?: string[];        // 走過的節點標籤
  context?: Record<string, unknown>;
  error?: string;
}

// 依 flow id（skill id）讀流程節點
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

// 執行流程：依序走節點，condition 分流
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
  // condition 節點可指定跳轉目標節點 id
  const byId = new Map<string, FlowNode>(nodes.filter((n) => n.id).map((n) => [n.id!, n]));

  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    const type = node.type ?? 'dummy';
    path.push(node.label ?? type);
    const cfg = node.config ?? {};

    if (type === 'skill') {
      const skillId = (cfg.skillId as string) ?? (cfg.target as string);
      const skill = skillId ? registry.get(skillId) : null;
      if (skill) {
        try {
          const conv = conversation ?? defaultConversation();
          const result = await executor.execute(skill, { ...args, ...context }, conv);
          context[skillId] = result.output;
        } catch (e) {
          logger.warn('flowRunner.skill_failed', { flowId, skillId, error: String(e) });
          context[skillId] = '';
        }
      }
    } else if (type === 'condition') {
      const field = cfg.field as string;
      const operator = (cfg.operator as string) ?? 'eq';
      const value = cfg.value;
      const actual = context[field];
      const hit = evaluate(actual, operator, value);
      const targetId = hit
        ? (cfg.onTrue as string)
        : (cfg.onFalse as string);
      if (targetId && byId.has(targetId)) {
        i = nodes.findIndex((n) => n.id === targetId);
        continue;
      }
      // 無跳轉目標 → 依結果選擇下一個節點
      if (hit) {
        // 繼續下一節點（true 分支）
      } else {
        // false 分支：跳到 onFalse 後的節點；若無指定則結束
        const falseIdx = nodes.findIndex((n) => n.id === cfg.onFalse);
        if (cfg.onFalse && falseIdx >= 0) {
          i = falseIdx;
          continue;
        }
        break;
      }
    } else if (type === 'reply') {
      const text = (cfg.text as string) ?? '';
      return { ok: true, output: interpolate(text, context), path, context };
    }

    i += 1;
  }

  // 沒有 reply 節點 → 組裝所有 skill 輸出
  const parts = nodes
    .filter((n) => n.type === 'skill')
    .map((n) => {
      const skillId = ((n.config ?? {}).skillId ?? (n.config ?? {}).target) as string;
      return skillId && context[skillId] ? String(context[skillId]) : '';
    })
    .filter(Boolean);
  return {
    ok: parts.length > 0,
    output: parts.join('\n\n'),
    path,
    context,
  };
}

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
