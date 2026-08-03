// sam LINE Agent — 共用 LLM HTTP client
//
// 設計：
//   - LLM_API_KEY 有設 → remote OpenAI-compatible API
//   - 沒設 → 自動讀 ~/.dllm/config.json（同 taskforge 行為）
//   - 統一 chat completion 介面
//   - timeout / retry 用 AgentError 表達

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AgentError, toAgentError } from './errors.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface LLMConfig {
  apiKey: string;
  apiBase: string;
  model: string;
  source: 'env' | 'dllm-fallback';
}

let _config: LLMConfig | null = null;

function loadDllmFallback(): { apiKey: string; model: string } {
  const path = join(homedir(), '.dllm', 'config.json');
  try {
    const raw = readFileSync(path, 'utf8');
    const j = JSON.parse(raw) as { api_key?: string; default_model?: string };
    if (!j.api_key) {
      throw new AgentError('INTERNAL_ERROR', `dllm config at ${path} missing api_key`, {
        context: { configPath: path },
      });
    }
    return {
      apiKey: j.api_key,
      model: j.default_model ?? 'Qwythos-9B-Claude-Mythos-5-1M',
    };
  } catch (e) {
    if (e instanceof AgentError) throw e;
    throw new AgentError(
      'INTENT_CLASSIFICATION_FAILED',
      `failed to load dllm fallback config: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e, context: { configPath: path } },
    );
  }
}

export function getLLMConfig(): LLMConfig {
  if (_config) return _config;
  const envKey = process.env.LLM_API_KEY?.trim();
  const envBase = process.env.LLM_API_BASE?.trim();
  const envModel = process.env.LLM_MODEL?.trim();

  if (envKey && envKey.length > 0) {
    _config = {
      apiKey: envKey,
      apiBase: envBase && envBase.length > 0 ? envBase : 'https://api.openai.com/v1',
      model: envModel && envModel.length > 0 ? envModel : 'gpt-4o',
      source: 'env',
    };
    return _config;
  }

  const fallback = loadDllmFallback();
  _config = {
    apiKey: fallback.apiKey,
    apiBase: envBase && envBase.length > 0 ? envBase : 'https://dllm.aiconn.ai/v1',
    model: envModel && envModel.length > 0 ? envModel : fallback.model,
    source: 'dllm-fallback',
  };
  return _config;
}

export function resetLLMConfig(): void {
  _config = null;
}

export async function chatCompletion(opts: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const cfg = getLLMConfig();
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1024,
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  try {
    const res = await fetch(`${cfg.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new AgentError(
        'INTENT_CLASSIFICATION_FAILED',
        `LLM HTTP ${res.status}: ${errText.slice(0, 200)}`,
        { context: { status: res.status, source: cfg.source } },
      );
    }

    const j = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      model?: string;
      usage?: ChatCompletionResult['usage'];
    };

    const content = j.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new AgentError('INTENT_CLASSIFICATION_FAILED', 'LLM returned no content', {
        context: { source: cfg.source, response: j },
      });
    }

    return {
      content,
      model: j.model ?? cfg.model,
      usage: j.usage,
    };
  } catch (e) {
    if (e instanceof AgentError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new AgentError('INTENT_CLASSIFICATION_TIMEOUT', `LLM call timed out after ${timeoutMs}ms`, {
        context: { timeoutMs, source: cfg.source },
      });
    }
    throw toAgentError(e, 'INTENT_CLASSIFICATION_FAILED');
  } finally {
    clearTimeout(timer);
  }
}