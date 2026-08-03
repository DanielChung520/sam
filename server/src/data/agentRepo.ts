// Agent repository（ArangoDB）
//
// V2 schema（2026-07-30 擴充）：
//   - 加入 persona / category / template（功能性命名，非 proper name）
//   - 加入多 prompt（main + intentClassifier + clarification + qualityCheck）
//   - 加入 whitelist（enabledSkills/McpTools/SubAgents）
//   - 加入行為參數（intent threshold、clarification rounds、quality check）
//   - 加入 session 設定（conversationTtl、historyLimit）
//
// 向後相容：舊 agent 紀錄（沒有新欄位）會用 default 值。

import { getDb, ensureCollection } from './arango.js';

export type AgentCategory =
  | 'orchestrator'   // 對話編排（Polaris）
  | 'planner'        // 任務規劃（Sirius）
  | 'reviewer'       // 品質觀察（Vega）
  | 'memory'         // 記憶管理（Altair）
  | 'consultant'     // 深度諮詢（Deneb）
  | 'worker';        // Sub-Agent（Rigel/Betelgeuse/...）

export interface AgentPersona {
  archetype: 'orchestrator' | 'specialist' | 'worker';
  role: string;
  traits: string[];
  myth: string;
}

export interface AgentPrompts {
  main: string;
  intentClassifier?: string;
  clarification?: string;
  qualityCheck?: string;
}

export interface Agent {
  _key: string;
  name: string;
  template: string;            // 功能性命名（'客服助理'）
  description: string;
  category: AgentCategory;
  enabled: boolean;

  // 個性 / 角色
  persona: AgentPersona;

  // LLM
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  personToken: string;

  // 多 prompt（V2）
  prompts: AgentPrompts;

  // Whitelist（V2）
  enabledSkills: string[];
  enabledMcpTools: string[];
  enabledSubAgents: string[];   // 只有 main agent 用

  // 行為參數（V2）
  intentConfidenceThreshold: number;
  maxClarificationRounds: number;
  enableQualityCheck: boolean;

  // Session（V2）
  conversationTtl: number;
  historyLimit: number;

  // Rate limiting
  maxMessagesPerDay: number;
  cooldownSeconds: number;

  // Auto-reply
  autoReplyEnabled: boolean;
  autoReplyMessage: string;

  // Webhook（自動產生）
  webhookPath: string;

  // / 指令列表 + 行為路由（Polaris 驅動）
  slashCommands?: Array<{
    command: string;
    label: string;
    description: string;
    target: string;
    targetType: 'skill' | 'agent';
    enabled: boolean;
    argHint?: string;
  }>;
  // 意圖規則（型別(message.type)/細分型/判斷/行為）
  intents?: Array<{
    id: string;
    name: string;
    messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
    subType?: string;
    match: {
      type: 'keyword' | 'regex';
      patterns: string[];
    };
    behavior: {
      action: 'agent' | 'skill' | 'llm';
      target: string;
      params?: Record<string, unknown>;
    };
    enabled: boolean;
    priority: number;
  }>;
  routing?: Array<{
    id: string;
    pattern: string;
    matchType: 'keyword' | 'regex' | 'type';
    action: 'skill' | 'agent' | 'reply';
    target: string;
    params: Record<string, unknown>;
    enabled: boolean;
  }>;

  createdAt: number;
  updatedAt: number;
}

const COLLECTION = 'agents';

export async function ensureAgentsCollection(): Promise<void> {
  await ensureCollection(COLLECTION);
}

/* ── Defaults（向後相容） ── */

function withDefaults(raw: any): Agent {
  return {
    _key: raw._key,
    name: raw.name ?? '',
    template: raw.template ?? raw.name ?? '',
    description: raw.description ?? '',
    category: raw.category ?? 'worker',
    enabled: raw.enabled ?? true,

    persona: raw.persona ?? {
      archetype: 'worker',
      role: '',
      traits: [],
      myth: '',
    },

    systemPrompt: raw.systemPrompt ?? '',
    model: raw.model ?? 'gpt-4o',
    temperature: raw.temperature ?? 0.7,
    maxTokens: raw.maxTokens ?? 2000,
    personToken: raw.personToken ?? '',

    prompts: raw.prompts ?? {
      main: raw.systemPrompt ?? '',
      intentClassifier: raw.prompts?.intentClassifier,
      clarification: raw.prompts?.clarification,
      qualityCheck: raw.prompts?.qualityCheck,
    },

    enabledSkills: raw.enabledSkills ?? [],
    enabledMcpTools: raw.enabledMcpTools ?? [],
    enabledSubAgents: raw.enabledSubAgents ?? [],

    intentConfidenceThreshold: raw.intentConfidenceThreshold ?? 0.5,
    maxClarificationRounds: raw.maxClarificationRounds ?? 2,
    enableQualityCheck: raw.enableQualityCheck ?? false,

    conversationTtl: raw.conversationTtl ?? 1800,
    historyLimit: raw.historyLimit ?? 20,

    maxMessagesPerDay: raw.maxMessagesPerDay ?? 1000,
    cooldownSeconds: raw.cooldownSeconds ?? 0,
    autoReplyEnabled: raw.autoReplyEnabled ?? false,
    autoReplyMessage: raw.autoReplyMessage ?? '目前不在服務時間，我們將在營業時間盡快回覆您！',

    webhookPath: raw.webhookPath ?? `/webhook/agent_${raw._key}`,

    slashCommands: raw.slashCommands ?? [],
    intents: raw.intents ?? [],
    routing: raw.routing ?? [],

    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? Date.now(),
  };
}

/* ── CRUD ── */

export async function listAgents(): Promise<Agent[]> {
  await ensureAgentsCollection();
  const db = getDb();
  const cursor = await db.query(`FOR a IN ${COLLECTION} SORT a.createdAt ASC RETURN a`);
  return (await cursor.all()).map(withDefaults) as Agent[];
}

export async function findAgentById(id: string): Promise<Agent | null> {
  await ensureAgentsCollection();
  const db = getDb();
  try {
    const doc = await db.collection(COLLECTION).document(id);
    return withDefaults(doc);
  } catch { return null; }
}

// 找系統固定的 Orchestration agent（category = orchestrator，第一個啟用的）
export async function findOrchestrationAgent(): Promise<Agent | null> {
  await ensureAgentsCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR a IN ${COLLECTION} FILTER a.category == 'orchestrator' AND a.enabled != false SORT a.createdAt ASC LIMIT 1 RETURN a`
  );
  const results = (await cursor.all()) as any[];
  return results.length > 0 ? withDefaults(results[0]) : null;
}

export async function upsertAgent(input: Omit<Agent, 'webhookPath' | 'createdAt' | 'updatedAt'> & { webhookPath?: string; createdAt?: number; updatedAt?: number }): Promise<Agent> {
  await ensureAgentsCollection();
  const db = getDb();
  const now = Date.now();

  const webhookPath = input.webhookPath ?? `/webhook/agent_${input._key}`;

  const doc = {
    ...input,
    webhookPath,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };

  const collection = db.collection(COLLECTION);
  try {
    const existing = await collection.document(input._key);
    await collection.update(input._key, { ...doc, createdAt: existing.createdAt });
    return withDefaults({ ...doc, createdAt: existing.createdAt });
  } catch {
    await collection.save(doc);
    return withDefaults(doc);
  }
}

export async function deleteAgent(id: string): Promise<boolean> {
  await ensureAgentsCollection();
  const db = getDb();
  try { await db.collection(COLLECTION).remove(id); return true; } catch { return false; }
}

/* ── Type-safe input for new agents ── */

export type AgentInput = Omit<Agent, 'webhookPath' | 'createdAt' | 'updatedAt'> & { webhookPath?: string };