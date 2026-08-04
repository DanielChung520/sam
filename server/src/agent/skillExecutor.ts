// sam LINE Agent — Skill Executor
//
// 支援五種 executor type：
//   - inline:      內部函式（已註冊 handler）
//   - taskforge:   呼叫 taskforge sub-agent
//   - http:        外部 HTTP API
//   - process:     跑 skill_flows 流程（flowRunner）
//   - script:      vm sandbox 執行 AI 生成的程式碼（白名單：args/callSkill/log）

import type {
  Conversation,
  SkillExecutionResult,
  SkillManifest,
  SkillExecutor as SkillExecutorSpec,
  TaskforgeTaskSpec,
} from './types.js';
import { AgentError, toAgentError } from './errors.js';
import { Metrics } from '../lib/metrics.js';
import { getSkillRegistry } from './skillRegistry.js';

export type InlineSkillHandler = (
  args: Record<string, unknown>,
  conversation: Conversation,
) => Promise<SkillExecutionResult>;

class InlineRegistry {
  private handlers = new Map<string, InlineSkillHandler>();

  register(handlerName: string, handler: InlineSkillHandler): void {
    this.handlers.set(handlerName, handler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  async run(
    name: string,
    args: Record<string, unknown>,
    conversation: Conversation,
  ): Promise<SkillExecutionResult> {
    const fn = this.handlers.get(name);
    if (!fn) {
      throw new AgentError('SKILL_NOT_FOUND', `inline handler not registered: ${name}`, {
        context: { handlerName: name },
      });
    }
    return fn(args, conversation);
  }
}

const _inlineRegistry = new InlineRegistry();

export function registerInlineHandler(name: string, handler: InlineSkillHandler): void {
  _inlineRegistry.register(name, handler);
}

export function hasInlineHandler(name: string): boolean {
  return _inlineRegistry.has(name);
}

export interface ExecutorDeps {
  taskforgeBaseUrl?: string;
  httpTimeoutMs?: number;
  taskforgeTimeoutMs?: number;
}

export class SkillRunner {
  private readonly deps: ExecutorDeps;

  constructor(deps: ExecutorDeps = {}) {
    this.deps = deps;
  }

  async execute(
    skill: SkillManifest,
    args: Record<string, unknown>,
    conversation: Conversation,
  ): Promise<SkillExecutionResult> {
    const timeoutMs = skill.timeoutMs ?? 120_000;
    Metrics.incSkillCall(skill.id);
    try {
      const result = await this.executeInner(skill.executor, args, conversation, timeoutMs);
      return result;
    } catch (e: unknown) {
      Metrics.pushError('skill.execute', e instanceof Error ? e.message : String(e), {
        skillId: skill.id,
        channelId: conversation.channelId,
      });
      if (e instanceof AgentError && e.code === 'SKILL_EXECUTION_TIMEOUT') throw e;
      throw toAgentError(e, 'SKILL_EXECUTION_FAILED');
    }
  }

private async executeInner(
    executor: SkillExecutorSpec,
    args: Record<string, unknown>,
    conversation: Conversation,
    timeoutMs: number,
  ): Promise<SkillExecutionResult> {
    if (executor.type === 'inline') {
      return _inlineRegistry.run(executor.handler, args, conversation);
    }
    if (executor.type === 'taskforge') {
      return this.executeTaskforge(executor.tasks, executor.goal, args, timeoutMs);
    }
    if (executor.type === 'http') {
      return this.executeHttp(executor, args, timeoutMs);
    }
    if (executor.type === 'process') {
      return this.executeProcess(executor.flowId, args);
    }
    if (executor.type === 'script') {
      return this.executeScript(executor.code, args);
    }
    throw new AgentError('SKILL_NOT_FOUND', 'unknown executor type', {
      context: { executor },
    });
  }

  // process → 跑 skill_flows 流程（flowRunner）
  private async executeProcess(
    flowId: string,
    args: Record<string, unknown>,
  ): Promise<SkillExecutionResult> {
    const { runFlow } = await import('./flowRunner.js');
    const result = await runFlow({ flowId, args });
    if (!result.ok) {
      throw new AgentError('SKILL_EXECUTION_FAILED', `flow failed: ${flowId}`, {
        context: { flowId, error: result.error },
      });
    }
    return { ok: true, output: result.output };
  }

  // script → vm sandbox 執行 AI 生成的程式碼（白名單：args/callSkill/log）
  private async executeScript(
    code: string,
    args: Record<string, unknown>,
  ): Promise<SkillExecutionResult> {
    const vm = await import('node:vm');
    const sandboxLogs: string[] = [];
    const sandbox: Record<string, unknown> = {
      args,
      log: (...xs: unknown[]) => sandboxLogs.push(xs.map(String).join(' ')),
      callSkill: async (skillId: string, skillArgs: Record<string, unknown> = {}) => {
        const registry = await getSkillRegistry();
        const skill = registry.get(skillId);
        if (!skill) throw new AgentError('SKILL_NOT_FOUND', `skill not found: ${skillId}`);
        return this.execute(skill, { ...args, ...skillArgs }, defaultScriptConversation());
      },
    };
    const context = vm.createContext(sandbox);
    // 包成 async IIFE 以支援 await
    const wrapped = `(async () => { ${code}\n})()`;
    const result = await vm.runInContext(wrapped, context, { timeout: 30_000 });
    const output = typeof result === 'string' ? result : JSON.stringify(result ?? '');
    return {
      ok: true,
      output: output === '""' ? sandboxLogs.join('\n') : output,
    };
  }

  private async executeTaskforge(
    tasks: TaskforgeTaskSpec[],
    goal: string | undefined,
    args: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<SkillExecutionResult> {
    const baseUrl = this.deps.taskforgeBaseUrl ?? process.env.TASKFORGE_BASE_URL ?? 'http://localhost:9900';
    const resolvedGoal = goal ?? String(args.query ?? args.topic ?? args.text ?? 'task');

    const tplCtx = { ...args, goal: resolvedGoal };
    const interpolated = tasks.map((t) => ({
      ...t,
      title: interpolate(t.title, tplCtx),
      description: interpolate(t.description, tplCtx),
    }));

    const created = await this.postJson(`${baseUrl}/v1/plans`, {
      goal: resolvedGoal,
      context: this.buildTaskforgeContext(args),
      tasks: interpolated.map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        description: t.description,
        depends_on: t.depends_on ?? [],
      })),
    });

    if (!created.plan_id) {
      throw new AgentError('TASKFORGE_API_ERROR', 'createPlan returned no plan_id', {
        context: { response: created },
      });
    }

    await this.postJson(`${baseUrl}/v1/plans/${created.plan_id}/execute`, {});

    const plan = await this.pollPlan(baseUrl, created.plan_id, timeoutMs);

    if (plan.status === 'failed') {
      throw new AgentError('TASKFORGE_API_ERROR', `plan failed: ${plan.error ?? 'unknown'}`, {
        context: { planId: created.plan_id, error: plan.error },
      });
    }

    return {
      ok: true,
      output: plan.output ?? this.summarizeTasks(plan.tasks),
      artifacts: {
        planId: created.plan_id,
        taskCount: plan.tasks?.length ?? 0,
        taskStatus: plan.tasks?.map((t: any) => ({ id: t.id, type: t.type, status: t.status })),
      },
    };
  }

  private async executeHttp(
    spec: Extract<SkillExecutorSpec, { type: 'http' }>,
    args: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<SkillExecutionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.deps.httpTimeoutMs ?? timeoutMs);
    try {
      const res = await fetch(spec.url, {
        method: spec.method,
        headers: { 'Content-Type': 'application/json', ...spec.headers },
        body: spec.method === 'POST' ? JSON.stringify(args) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new AgentError('SKILL_EXECUTION_FAILED', `HTTP ${res.status}: ${text.slice(0, 200)}`, {
          context: { url: spec.url, status: res.status },
        });
      }
      return {
        ok: true,
        output: text,
        artifacts: { url: spec.url, status: res.status },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async postJson(url: string, body: unknown): Promise<any> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new AgentError('TASKFORGE_API_ERROR', `HTTP ${res.status}: ${text.slice(0, 200)}`, {
        context: { url, status: res.status },
      });
    }
    return res.json();
  }

  private async pollPlan(
    baseUrl: string,
    planId: string,
    timeoutMs: number,
  ): Promise<any> {
    const started = Date.now();
    const intervalMs = 1500;
    while (Date.now() - started < timeoutMs) {
      const res = await fetch(`${baseUrl}/v1/plans/${encodeURIComponent(planId)}`);
      if (!res.ok) {
        throw new AgentError('TASKFORGE_API_ERROR', `getPlan HTTP ${res.status}`, {
          context: { planId, status: res.status },
        });
      }
      const j = (await res.json()) as { plan: any };
      const plan = j.plan;
      if (plan.status === 'completed' || plan.status === 'failed') return plan;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new AgentError('TASKFORGE_PLAN_TIMEOUT', `plan timed out after ${timeoutMs}ms`, {
      context: { planId, timeoutMs },
    });
  }

  private buildTaskforgeContext(args: Record<string, unknown>): string {
    const blocks: string[] = [];
    const systemContext = args.systemContext;
    if (typeof systemContext === 'string' && systemContext.trim()) {
      blocks.push(systemContext.trim());
    }
    const recentHistory = args.recentHistory;
    if (Array.isArray(recentHistory) && recentHistory.length > 0) {
      const lines = (recentHistory as Array<{ role: string; content: string }>)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');
      blocks.push(`## 近期對話\n${lines}`);
    }
    return blocks.join('\n\n');
  }

  private summarizeTasks(tasks: any[]): string {
    if (!Array.isArray(tasks)) return '';
    return tasks
      .filter((t) => t.output)
      .map((t) => `### ${t.title ?? t.id}\n${t.output}`)
      .join('\n\n');
  }
}

let _executor: SkillRunner | null = null;

export function getSkillExecutor(deps?: ExecutorDeps): SkillRunner {
  if (!_executor) _executor = new SkillRunner(deps);
  return _executor;
}

export function resetSkillExecutor(): void {
  _executor = null;
}

export function interpolate(template: string, ctx: Record<string, unknown>): string {
  if (!template) return template;
  // 支援兩種模板格式：${key}（skill manifest 慣用）與 {key}（FlowEditor 流程圖慣用）
  const replace = (m: string, key: string): string => {
    const trimmed = key.trim();
    const value = getNestedValue(ctx, trimmed);
    if (value === undefined || value === null) return m; // 保留原樣
    return String(value);
  };
  let out = template;
  if (out.includes('${')) {
    out = out.replace(/\$\{([^}]+)\}/g, (_m, key: string) => replace(_m, key));
  }
  if (out.includes('{') && !out.includes('${')) {
    // 僅當沒有 ${} 時才處理 {key}（避免誤替換 JSON）
    out = out.replace(/\{([a-zA-Z0-9_.[\]]+)\}/g, (m, key) => replace(m, key));
  }
  return out;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function defaultScriptConversation(): Conversation {
  const now = Date.now();
  return {
    id: `script_${now}`,
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