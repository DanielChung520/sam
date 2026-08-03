// Intent Engine — 多關鍵詞 → 意圖 → 行為 匹配引擎
//
// 取代寫死的意圖分類規則：意圖表（DB）定義「多個觸發條件 → 意圖 → 行為」，
// 引擎依輸入匹配，回傳意圖與對應行為。

import { findAgentById } from '../data/agentRepo.js';

const POLARIS_KEY = 'agent_polaris';

export type TriggerType = 'keyword' | 'regex' | 'event' | 'messageType' | 'ocrType' | 'slash';
export type IntentAction = 'skill' | 'agent' | 'llm' | 'reply';

export interface IntentRule {
  id: string;
  name: string;                       // 意圖名（問候/詢問/搜尋...）
  triggerType: TriggerType;
  triggers: string[];                 // 多個觸發條件（關鍵詞/regex/event名/messageType/ocrType）
  behavior: {
    action: IntentAction;
    target: string;                   // skill id / agent 名 / llm 提示 / reply 文字
    params?: Record<string, unknown>;
  };
  enabled: boolean;
  priority: number;                   // 數字越大越優先（同命中時）
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
  matchedTrigger: string;
}

// 依輸入匹配意圖規則（依 priority 高到低，回傳第一個命中）
export function matchIntent(
  text: string,
  rules: IntentRule[],
  context?: { eventType?: string; messageType?: string; ocrType?: string },
): IntentMatch | null {
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    for (const trigger of rule.triggers) {
      if (!trigger) continue;
      const hit = matchTrigger(rule.triggerType, trigger, text, context);
      if (hit) {
        return { rule, matchedTrigger: trigger };
      }
    }
  }
  return null;
}

function matchTrigger(
  type: TriggerType,
  trigger: string,
  text: string,
  context?: { eventType?: string; messageType?: string; ocrType?: string },
): boolean {
  const lower = text.toLowerCase();
  switch (type) {
    case 'keyword':
      return lower.includes(trigger.toLowerCase());
    case 'regex':
      try {
        return new RegExp(trigger, 'i').test(text);
      } catch {
        return false;
      }
    case 'slash':
      return lower.startsWith(trigger.toLowerCase());
    case 'event':
      return context?.eventType === trigger;
    case 'messageType':
      return context?.messageType === trigger;
    case 'ocrType':
      return context?.ocrType === trigger;
    default:
      return false;
  }
}
