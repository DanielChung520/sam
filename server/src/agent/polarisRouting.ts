// Polaris 路由設定 — 從 DB（Agent Center 的 Polaris）讀取行為路由與自訂指令
//
// 讓 Polaris 的「感知、意圖分析、行為路由」可透過 Agent Center 配置，
// 取代部分硬編碼 if/else。

import { findAgentById } from '../data/agentRepo.js';

const POLARIS_KEY = 'agent_polaris';

export interface SlashCommandConfig {
  command: string;
  label: string;
  description: string;
  target: string;
  targetType: 'skill' | 'agent';
  enabled: boolean;
  argHint?: string;
}

export interface RoutingRuleConfig {
  id: string;
  pattern: string;
  matchType: 'keyword' | 'regex' | 'type';
  action: 'skill' | 'agent' | 'reply';
  target: string;
  params: Record<string, unknown>;
  enabled: boolean;
}

export interface PolarisRoutingConfig {
  slashCommands?: SlashCommandConfig[];
  routing?: RoutingRuleConfig[];
}

let _cache: { data: PolarisRoutingConfig; at: number } | null = null;
const CACHE_TTL = 30_000;

export async function getPolarisConfig(): Promise<PolarisRoutingConfig> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL) return _cache.data;
  try {
    const polaris = await findAgentById(POLARIS_KEY);
    const data: PolarisRoutingConfig = {
      slashCommands: Array.isArray(polaris?.slashCommands) ? polaris.slashCommands : [],
      routing: Array.isArray(polaris?.routing) ? polaris.routing : [],
    };
    _cache = { data, at: Date.now() };
    return data;
  } catch {
    return { slashCommands: [], routing: [] };
  }
}

export function invalidatePolarisConfig(): void {
  _cache = null;
}

// 依輸入文字匹配路由規則（依序，第一個命中）
export function matchRoutingRule(
  text: string,
  rules: RoutingRuleConfig[] | undefined,
): RoutingRuleConfig | null {
  if (!rules || rules.length === 0) return null;
  const lower = text.toLowerCase();
  for (const rule of rules) {
    if (!rule.enabled || !rule.pattern) continue;
    try {
      if (rule.matchType === 'keyword') {
        if (lower.includes(rule.pattern.toLowerCase())) return rule;
      } else if (rule.matchType === 'regex') {
        if (new RegExp(rule.pattern, 'i').test(text)) return rule;
      } else if (rule.matchType === 'type') {
        if (lower === rule.pattern.toLowerCase()) return rule;
      }
    } catch {
      // 無效 regex 跳過
    }
  }
  return null;
}
