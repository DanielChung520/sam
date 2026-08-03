// sam LINE Agent — Intent classifier
//
// 兩段式策略：
//   1. Fast path: regex 偵測 slash command（向後相容舊 webhook 行為）
//   2. Slow path: LLM 分類（含 few-shot + 雙語）
//
// 信心度 < LOW_CONFIDENCE_THRESHOLD 時直接回 unknown。

import { type Intent } from './types.js';
import { AgentError, toAgentError } from './errors.js';
import { chatCompletion } from './llmClient.js';
import {
  intentClassifierSystemPrompt,
  buildIntentClassifierUserPrompt,
  type IntentClassifierUserContext,
} from './prompts/intentClassifier.js';

export const LOW_CONFIDENCE_THRESHOLD = 0.6;

const SLASH_COMMAND_RE = /^\/([a-zA-Z]+)\s*([\s\S]*)$/;
const MENU_SHOW_RE = /^\/\s*$/;
const MENU_CHOICE_RE = /^\s*([1-9])\s*$/;

export function detectSlashCommand(text: string): Intent | null {
  const trimmed = text.trim();
  const match = trimmed.match(SLASH_COMMAND_RE);
  if (!match) return null;
  return {
    type: 'slash_command',
    command: match[1].toLowerCase(),
    arg: match[2].trim(),
  };
}

export function detectMenuShow(text: string): Intent | null {
  if (MENU_SHOW_RE.test(text.trim())) {
    return { type: 'menu_show' };
  }
  return null;
}

export function detectMenuChoice(text: string): Intent | null {
  const match = text.trim().match(MENU_CHOICE_RE);
  if (!match) return null;
  return { type: 'menu_choice', number: parseInt(match[1], 10) };
}

interface LLMIntentResponse {
  type: string;
  command?: string;
  arg?: string;
  topic?: string;
  skillId?: string;
  entities?: Record<string, string>;
  refersTo?: string;
  lowConfidenceReason?: string;
  confidence: number;
  reasoning?: string;
}

function isValidIntentType(t: string): t is Intent['type'] {
  return [
    'greeting',
    'slash_command',
    'menu_show',
    'menu_choice',
    'question',
    'request_skill',
    'follow_up',
    'chitchat',
    'unknown',
  ].includes(t);
}

function buildIntentFromLLM(parsed: LLMIntentResponse): Intent {
  const type = parsed.type;
  if (!isValidIntentType(type)) {
    throw new AgentError(
      'INTENT_CLASSIFICATION_FAILED',
      `LLM returned invalid intent type: ${type}`,
      { context: { raw: parsed } },
    );
  }

  switch (type) {
    case 'greeting':
      return { type: 'greeting' };
    case 'slash_command':
      return {
        type: 'slash_command',
        command: parsed.command ?? '',
        arg: parsed.arg ?? '',
      };
    case 'menu_show':
      return { type: 'menu_show' };
    case 'menu_choice':
      return { type: 'menu_choice', number: parseInt(parsed.entities?.number ?? '0', 10) || 0 };
    case 'question':
      return { type: 'question', topic: parsed.topic ?? '' };
    case 'request_skill':
      return {
        type: 'request_skill',
        skillId: parsed.skillId ?? '',
        entities: parsed.entities ?? {},
      };
    case 'follow_up':
      return { type: 'follow_up', refersTo: parsed.refersTo ?? '' };
    case 'chitchat':
      return { type: 'chitchat' };
    case 'unknown':
      return {
        type: 'unknown',
        confidence: parsed.confidence,
      };
  }
}

export interface ClassifyOptions {
  history?: IntentClassifierUserContext['recentHistory'];
  availableSkills?: string[];
  timeoutMs?: number;
}

export interface ClassifyResult {
  intent: Intent;
  raw: string;
  latencyMs: number;
  source: 'slash-regex' | 'llm';
}

export async function classifyIntent(
  text: string,
  options: ClassifyOptions = {},
): Promise<ClassifyResult> {
  const startedAt = Date.now();

  const slash = detectSlashCommand(text);
  if (slash) {
    return {
      intent: slash,
      raw: JSON.stringify(slash),
      latencyMs: Date.now() - startedAt,
      source: 'slash-regex',
    };
  }

  const menuShow = detectMenuShow(text);
  if (menuShow) {
    return {
      intent: menuShow,
      raw: JSON.stringify(menuShow),
      latencyMs: Date.now() - startedAt,
      source: 'slash-regex',
    };
  }

  const menuChoice = detectMenuChoice(text);
  if (menuChoice) {
    return {
      intent: menuChoice,
      raw: JSON.stringify(menuChoice),
      latencyMs: Date.now() - startedAt,
      source: 'slash-regex',
    };
  }

  const userPrompt = buildIntentClassifierUserPrompt(text, {
    recentHistory: options.history,
    availableSkills: options.availableSkills,
  });

  let result;
  try {
    result = await chatCompletion({
      messages: [
        { role: 'system', content: intentClassifierSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      jsonMode: true,
      temperature: 0.1,
      timeoutMs: options.timeoutMs ?? 15_000,
    });
  } catch (e) {
    throw toAgentError(e, 'INTENT_CLASSIFICATION_FAILED');
  }

  const raw = result.content.trim();

  let parsed: LLMIntentResponse;
  try {
    parsed = JSON.parse(extractJSON(raw));
  } catch (e) {
    throw new AgentError(
      'INTENT_CLASSIFICATION_FAILED',
      `failed to parse LLM JSON: ${raw.slice(0, 200)}`,
      { cause: e, context: { raw } },
    );
  }

  if (typeof parsed.confidence !== 'number') {
    throw new AgentError(
      'INTENT_CLASSIFICATION_FAILED',
      'LLM response missing confidence field',
      { context: { raw } },
    );
  }

  if (parsed.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return {
      intent: { type: 'unknown', confidence: parsed.confidence },
      raw,
      latencyMs: Date.now() - startedAt,
      source: 'llm',
    };
  }

  return {
    intent: buildIntentFromLLM(parsed),
    raw,
    latencyMs: Date.now() - startedAt,
    source: 'llm',
  };
}

function extractJSON(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}