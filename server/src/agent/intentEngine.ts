// Intent Engine — 意圖規則匹配引擎
//
// 規則結構（DB 配置，存於 agent_polaris.intents）：
//   名稱 / 型別(message.type) / 細分型(subType) / 判斷(keyword|regex) / 行為(agent|skill|llm)
// 例：
//   { name: '問候', messageType: 'text', subType: '問候', match: { type: 'keyword', patterns: ['你好','哈囉'] },
//     behavior: { action: 'llm', target: '' }, priority: 50 }
//   { name: '名片收集', messageType: 'image', subType: '名片', match: { type: 'keyword', patterns: [] },
//     behavior: { action: 'skill', target: 'card-collection' }, priority: 90 }

import { findAgentById } from '../data/agentRepo.js';

const POLARIS_KEY = 'agent_polaris';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
export type IntentAction = 'agent' | 'skill' | 'llm';

export interface IntentRule {
  id: string;
  name: string;                        // 意圖名稱（問候/名片收集...）
  messageType: MessageType;            // 型別：message.type
  subType?: string;                    // 細分型（text: 問候/打招呼/詢問/指令; image: 問候及祝福/名片/其他）
  match: {
    type: 'keyword' | 'regex';         // 判斷方式
    patterns: string[];                // 關鍵詞 或 regex pattern
  };
  behavior: {
    action: IntentAction;              // 行為：agent（Sub-Agent）/ skill（Skills）/ llm（LLM）
    target: string;                    // agent 名 / skill id / llm 提示
    params?: Record<string, unknown>;
  };
  enabled: boolean;
  priority: number;                    // 數字越大越優先（同命中時）
}

interface PolarisIntentConfig {
  intents?: IntentRule[];
}

let _cache: { data: PolarisIntentConfig; at: number } | null = null;
const CACHE_TTL = 30_000;

export async function getIntentRules(): Promise<IntentRule[]> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL) return _cache.data.intents ?? [];
  try {
    const polaris = await findAgentById(POLARIS_KEY);
    const intents = Array.isArray((polaris as any)?.intents) ? (polaris as any).intents : [];
    _cache = { data: { intents }, at: Date.now() };
    return intents;
  } catch {
    return [];
  }
}

export function invalidateIntentCache(): void {
  _cache = null;
}

export interface IntentMatch {
  rule: IntentRule;
  matchedPattern: string;
}

// 依輸入匹配意圖規則（依 priority 高到低，回傳第一個命中）
// input.text: 文字內容（text 型別用）；input.subType: 細分型（image 由 OCR 結果、text 由分類）
export function matchIntent(
  input: { text?: string; messageType?: MessageType; subType?: string },
  rules: IntentRule[],
): IntentMatch | null {
  const msgType = input.messageType ?? 'text';
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    if (rule.messageType !== msgType) continue;
    // 細分型過濾：僅非 text 型別（image/video...）以 subType 為輸入條件；
    // text 的 subType 是歸類標籤，匹配靠 patterns
    if (rule.messageType !== 'text' && rule.subType && rule.subType !== input.subType) continue;

    // 判斷：patterns 為空時僅靠 messageType/subType 命中（如 image 名片）
    if (rule.match.patterns.length === 0) {
      return { rule, matchedPattern: '' };
    }
    for (const pattern of rule.match.patterns) {
      if (!pattern) continue;
      if (matchPattern(rule.match.type, pattern, input.text ?? '')) {
        return { rule, matchedPattern: pattern };
      }
    }
  }
  return null;
}

function matchPattern(type: 'keyword' | 'regex', pattern: string, text: string): boolean {
  if (type === 'keyword') {
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
  try {
    return new RegExp(pattern, 'i').test(text);
  } catch {
    return false;
  }
}
