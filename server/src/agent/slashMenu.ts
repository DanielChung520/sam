// Unified / Menu — 動態掃描所有可呼叫物件
//
// 從 agents collection + skill registry 自動組合 menu
// 編號連續，user 可用 /name 或 編號 兩種方式呼叫

import { listAgents, findAgentById } from '../data/agentRepo.js';
import { findChannelById } from '../data/channelRepo.js';
import { getSkillRegistry } from './skillRegistry.js';

export type MenuItemType = 'main_agent' | 'sub_agent' | 'skill';

export interface MenuItem {
  index: number;
  type: MenuItemType;
  id: string;
  name: string;
  description: string;
  triggers?: string[];
  argHint?: string;
}

export interface ResolvedTarget {
  type: MenuItemType;
  id: string;
  name: string;
  remainingArgs: string;
}

const MAIN_AGENT_CATEGORIES = new Set(['orchestrator', 'planner', 'reviewer', 'memory', 'consultant']);

// 系統指令不受 channel 權限限制（默認可用）
export const SYSTEM_COMMANDS = new Set(['/', 'new', 'help', 'readme']);

// 基礎 skills — 所有 skills 都是 channel 默認必備（skills 是 agent 的能力指導，不在 channel 層勾選；
// 特殊技能未來由 agent/subagent 的 enabledSkills 白名單指定）
export const BASE_SKILLS = new Set<string>();  // 全開：channel 不過濾 skill

// / 選單顯示白名單 — 只顯示以下項目（其餘 agent/skill 仍可用，但不顯示在選單）
// 對應：2 Deneb / 9 Aldebaran / 12 Betelgeuse / 13 Capella / 14 Rigel / 15 Spica / 18 網路搜尋 / 20 完整寫作
export const VISIBLE_MENU_IDS = new Set([
  'agent_deneb',       // 深度諮詢
  'agent_aldebaran',   // 大綱設計
  'agent_betelgeuse',  // 深度分析（取代 analyze skill）
  'agent_capella',     // 質疑驗證
  'agent_rigel',       // 資料蒐集
  'agent_spica',       // 內容撰寫
  'web-search',        // 網路搜尋
  'write',             // 完整寫作
]);

let cachedMenu: MenuItem[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

// 解析 channel 的允許清單：
//   - 無 channel / channel 無設定 → null（全部允許）
//   - 有設定 → 主 agent 白名單 ∪ 各授權 agent 白名單 ∪ channel.permissions 額外增補
export async function resolveAllowedIds(channelId?: string): Promise<Set<string> | null> {
  if (!channelId) return null;
  try {
    const channel = await findChannelById(channelId);
    if (!channel) return null;

    const perms = channel.permissions;
    if (!Array.isArray(perms)) return null;

    const allowed = new Set(perms);

    // 主 agent + 授權 agents：agent 本身 + 白名單合併
    const agentKeys = [channel.linkedAgentKey, ...(channel.authorizedAgents ?? [])].filter(Boolean);
    for (const key of agentKeys) {
      allowed.add(key);
      const agent = await findAgentById(key);
      if (agent) {
        for (const s of agent.enabledSkills ?? []) allowed.add(s);
        for (const s of agent.enabledSubAgents ?? []) allowed.add(s);
        for (const s of agent.enabledMcpTools ?? []) allowed.add(s);
      }
    }

    return allowed;
  } catch {
    return null;
  }
}

// 查 channel 允許的 slash 項目 id 集合（向後相容包裝）
async function getAllowedIds(channelId?: string): Promise<Set<string> | null> {
  return resolveAllowedIds(channelId);
}

export function isAllowedById(allowed: Set<string> | null, id: string): boolean {
  if (!allowed) return true;
  if (BASE_SKILLS.has(id)) return true;
  return allowed.has(id);
}

export function isAllowedItem(item: MenuItem, allowed: Set<string> | null): boolean {
  if (!allowed) return true;
  if (item.type === 'skill') return true;   // skills 是 agent 能力，channel 不過濾
  return allowed.has(item.id);              // agents 按授權過濾
}

export async function buildSlashMenu(channelId?: string): Promise<MenuItem[]> {
  const now = Date.now();
  if (cachedMenu && now - cachedAt < CACHE_TTL_MS) {
    return filterMenuByPermissions(cachedMenu, await getAllowedIds(channelId));
  }

  const items: MenuItem[] = [];
  let idx = 0;

  const agents = await listAgents();
  const mainAgents = agents
    .filter((a) => a.enabled !== false && MAIN_AGENT_CATEGORIES.has(a.category))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const a of mainAgents) {
    items.push({
      index: ++idx,
      type: 'main_agent',
      id: a._key,
      name: a.name,
      description: a.template ?? a.persona?.role ?? '',
    });
  }

  const subAgents = agents
    .filter((a) => a.enabled !== false && a.category === 'worker')
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const a of subAgents) {
    items.push({
      index: ++idx,
      type: 'sub_agent',
      id: a._key,
      name: a.name,
      description: a.template ?? a.persona?.role ?? '',
    });
  }

  try {
    const registry = await getSkillRegistry();
    const skills = registry.list().filter((s) => s.enabled !== false);
    for (const s of skills) {
      const firstTrigger = s.triggers?.[0];
      const argHint = s.parameters?.[0]?.name;
      items.push({
        index: ++idx,
        type: 'skill',
        id: s.id,
        name: s.name,
        description: s.description,
        triggers: s.triggers,
        argHint,
        ...(firstTrigger ? {} : {}),
      });
    }
  } catch {
    // skill registry may not be initialized; skip
  }

  cachedMenu = items;
  cachedAt = now;
  return filterMenuByPermissions(items, await getAllowedIds(channelId));
}

function filterMenuByPermissions(items: MenuItem[], allowed: Set<string> | null): MenuItem[] {
  if (!allowed) return items;
  let idx = 0;
  return items
    .filter((m) => isAllowedItem(m, allowed))
    .map((m) => ({ ...m, index: ++idx }));
}

export function invalidateMenuCache(): void {
  cachedMenu = null;
  cachedAt = 0;
}

export async function resolveSlashCommand(input: string, channelId?: string): Promise<ResolvedTarget | null> {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const afterSlash = trimmed.slice(1).trim();
  if (!afterSlash) return null;

  const allowed = await getAllowedIds(channelId);
  const menu = await buildSlashMenu(channelId);
  if (afterSlash === 'menu' || afterSlash === 'help' || afterSlash === '?') {
    return null;
  }

  const parts = afterSlash.split(/\s+/);
  const head = parts[0].toLowerCase();
  const remainingArgs = parts.slice(1).join(' ');

  // 系統指令（/readme /new /help）不受權限限制
  if (head === 'readme') {
    return {
      type: 'skill',
      id: 'readme',
      name: '指令文件（README）',
      remainingArgs,
    };
  }

  const exactMatch = menu.find((m) => m.name.toLowerCase() === head);
  if (exactMatch && isAllowedItem(exactMatch, allowed)) {
    return {
      type: exactMatch.type,
      id: exactMatch.id,
      name: exactMatch.name,
      remainingArgs,
    };
  }

  // skill id 精確匹配（如 /stt /file-process /web-search）
  const idExact = menu.find(
    (m) => isAllowedItem(m, allowed) && m.id.toLowerCase() === head
  );
  if (idExact) {
    return {
      type: idExact.type,
      id: idExact.id,
      name: idExact.name,
      remainingArgs,
    };
  }

  // triggers 精確匹配優先（如 /greeting → greeting skill，而非 greeting-card）
  const triggerExact = menu.find(
    (m) => isAllowedItem(m, allowed) && (m.triggers ?? []).some((t) => t.toLowerCase() === head)
  );
  if (triggerExact) {
    return {
      type: triggerExact.type,
      id: triggerExact.id,
      name: triggerExact.name,
      remainingArgs,
    };
  }

  const partialMatches = menu.filter(
    (m) => isAllowedItem(m, allowed) && (m.name.toLowerCase().startsWith(head) || (m.triggers ?? []).some((t) => t.toLowerCase().startsWith(head)))
  );
  if (partialMatches.length === 1) {
    return {
      type: partialMatches[0].type,
      id: partialMatches[0].id,
      name: partialMatches[0].name,
      remainingArgs,
    };
  }

  return null;
}

export async function resolveMenuChoice(input: string, channelId?: string): Promise<ResolvedTarget | null> {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const idx = Number(trimmed);
  const menu = (await buildSlashMenu(channelId)).filter((m) => VISIBLE_MENU_IDS.has(m.id));
  // 與顯示選單一致的連續編號
  const visible = menu.map((m, i) => ({ ...m, index: i + 1 }));
  const item = visible.find((m) => m.index === idx);
  if (!item) return null;
  return {
    type: item.type,
    id: item.id,
    name: item.name,
    remainingArgs: '',
  };
}

export async function formatSlashMenuText(channelId?: string): Promise<string> {
  const visible = (await buildSlashMenu(channelId)).filter((m) => VISIBLE_MENU_IDS.has(m.id));
  // 重新連續編號（顯示用）
  visible.forEach((m, i) => {
    m.index = i + 1;
  });
  const lines: string[] = ['📋 可用功能：', ''];

  const group = (label: string, type: MenuItemType) => {
    const items = visible.filter((m) => m.type === type);
    if (items.length === 0) return;
    lines.push(label);
    for (const m of items) {
      const hint = m.argHint ? ` <${m.argHint}>` : '';
      lines.push(`  ${m.index}. /${m.name}${hint}    ${m.description}`);
    }
    lines.push('');
  };

  group('🤖 主 Agents（會自己做決策）', 'main_agent');
  group('⚙️ Sub-Agents（執行單一任務）', 'sub_agent');
  group('🛠 Skills（即時工具）', 'skill');

  lines.push('回覆數字選擇，或直接輸入 /指令 內容。');
  lines.push('輸入 /？ 查看完整指令說明文件。');
  return lines.join('\n');
}