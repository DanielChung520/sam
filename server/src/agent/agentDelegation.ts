// Agent Delegation Framework
//
// 讓 agent 之間互相呼叫，含 max depth 保護 + 迴圈偵測
//
// 呼叫階層（user 確認 max depth = 3）：
//   L1 (depth=0): user → 主 agent
//   L2 (depth=1): 主 agent → sub-agent
//   L3 (depth=2): sub-agent → skill
//   L4+: ❌ 不允許

import { findAgentById, listAgents } from '../data/agentRepo.js';
import type { Agent } from '../data/agentRepo.js';
import { chatCompletion, type ChatMessage } from './llmClient.js';
import { getSkillRegistry } from './skillRegistry.js';
import { getSkillExecutor } from './skillExecutor.js';
import type { Conversation } from './types.js';

export const MAX_DELEGATION_DEPTH = 3;

export interface DelegationInput {
  agentName: string;
  userMessage: string;
  depth?: number;
  history?: string[];
  customerId?: string;
  channelId?: string;
  systemContext?: string;
  conversation?: Conversation;
}

export interface DelegationResult {
  text: string;
  agentName: string;
  depth: number;
  durationMs: number;
  usedSkill?: string;
  planId?: string;
}

export type DelegationErrorCode = 'DEPTH_EXCEEDED' | 'LOOP_DETECTED' | 'AGENT_NOT_FOUND';

export class DelegationError extends Error {
  code: DelegationErrorCode;
  constructor(code: DelegationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function canDelegate(targetName: string, depth: number, history: string[]): { ok: boolean; reason?: string } {
  if (depth >= MAX_DELEGATION_DEPTH) {
    return { ok: false, reason: `max depth ${MAX_DELEGATION_DEPTH} exceeded` };
  }
  if (history.includes(targetName)) {
    return { ok: false, reason: `loop detected: ${targetName} already in call chain [${history.join(' → ')}]` };
  }
  return { ok: true };
}

async function resolveAgentByName(name: string): Promise<Agent | null> {
  const lower = name.toLowerCase();
  const all = await listAgents();
  const exact = all.find((a) => a.name.toLowerCase() === lower);
  if (exact) return exact;
  const partial = all.filter((a) => a.name.toLowerCase().startsWith(lower));
  return partial.length === 1 ? partial[0] : null;
}

export async function delegateToAgent(input: DelegationInput): Promise<DelegationResult> {
  const depth = input.depth ?? 0;
  const history = input.history ?? [];
  const start = Date.now();

  const check = canDelegate(input.agentName, depth, history);
  if (!check.ok) {
    if (check.reason?.includes('max depth')) throw new DelegationError('DEPTH_EXCEEDED', check.reason);
    if (check.reason?.includes('loop')) throw new DelegationError('LOOP_DETECTED', check.reason);
    throw new DelegationError('AGENT_NOT_FOUND', check.reason ?? 'unknown');
  }

  const agent = await resolveAgentByName(input.agentName);
  if (!agent) {
    throw new DelegationError('AGENT_NOT_FOUND', `agent "${input.agentName}" not found`);
  }

  // L3: sub-agent → skill（depth >= 1 時允許呼叫 skill）
  let skillOutput: string | undefined;
  let usedSkill: string | undefined;
  let planId: string | undefined;
  if (depth >= 1) {
    try {
      const skillRun = await tryExecuteMatchingSkill(input);
      if (skillRun) {
        skillOutput = skillRun.output;
        usedSkill = skillRun.skillId;
        planId = skillRun.planId;
      }
    } catch (e) {
      console.warn('[agentDelegation] skill execution failed, continuing with LLM only:', e);
    }
  }

  const personaSection = formatAgentPersonaForDelegation(agent);
  const contextBlocks = [
    personaSection,
    input.systemContext,
    skillOutput ? `\n\n## 工具執行結果（${usedSkill}）\n${skillOutput}` : '',
  ].filter(Boolean);
  const sysPrompt = contextBlocks.join('\n\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: input.userMessage },
  ];

  const result = await chatCompletion({
    messages,
    temperature: 0.7,
    maxTokens: 2000,
    timeoutMs: 60_000,
  });

  return {
    text: result.content,
    agentName: agent.name,
    depth,
    durationMs: Date.now() - start,
    usedSkill,
    planId,
  };
}

async function tryExecuteMatchingSkill(
  input: DelegationInput,
): Promise<{ skillId: string; output: string; planId?: string } | null> {
  const registry = await getSkillRegistry();
  const conversation = input.conversation ?? (input.channelId
    ? { id: `${input.channelId}:${input.customerId ?? 'anon'}`, channelId: input.channelId, userId: input.customerId ?? '', state: 'idle' as const, history: [], context: {}, createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 1800000 }
    : null);
  if (!conversation) return null;

  // 依使用者訊息意圖找 skill（用 LLM 分類）
  const { classifyIntent } = await import('./intentClassifier.js');
  let intent;
  try {
    const result = await classifyIntent(input.userMessage, {
      availableSkills: registry.list().map((s) => s.id),
      timeoutMs: 15_000,
    });
    intent = result.intent;
  } catch {
    return null;
  }

  const match = registry.match(intent);
  if (!match) return null;

  const args: Record<string, unknown> = { ...input };
  if (intent.type === 'request_skill') {
    Object.assign(args, intent.entities);
  } else if (intent.type === 'slash_command') {
    args.query = intent.arg;
    args.topic = intent.arg;
  }

  const executor = getSkillExecutor();
  const result = await executor.execute(match.skill, args, conversation);
  return {
    skillId: match.skill.id,
    output: result.output,
    planId: result.artifacts?.planId as string | undefined,
  };
}

function formatAgentPersonaForDelegation(agent: any): string {
  const p = agent.persona ?? {};
  const lines: string[] = [];
  lines.push(`你是 ${agent.name}（${agent.template ?? p.role ?? ''}）— ${agent.description ?? ''}`);
  if (p.traits?.length) lines.push(`\n特質：${p.traits.join('、')}`);
  if (p.myth) lines.push(`\n背景：${p.myth}`);
  if (agent.systemPrompt) lines.push(`\n${agent.systemPrompt}`);
  lines.push(`\n當前任務：回應使用者的請求。`);
  return lines.join('\n');
}

let _delegationStats = new Map<string, { lastCalled: number; callCount: number }>();

export function recordDelegation(agentName: string): void {
  const prev = _delegationStats.get(agentName) ?? { lastCalled: 0, callCount: 0 };
  _delegationStats.set(agentName, {
    lastCalled: Date.now(),
    callCount: prev.callCount + 1,
  });
}

export function getDelegationStats(): Map<string, { lastCalled: number; callCount: number }> {
  return _delegationStats;
}