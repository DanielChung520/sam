// sam LINE Agent — 型別定義
//
// 三層模型：
//   Tool    → 原子 HTTP / DB 操作（外部）
//   Skill   → 程序性知識包（stateless，由 agent 呼叫）
//   Agent   → 有狀態決策主體（持有 conversation state）

export type AgentState =
  | 'idle'
  | 'understanding'
  | 'executing'
  | 'responding'
  | 'awaiting_followup'
  | 'error';

export const AgentStateTransitions: Record<AgentState, AgentState[]> = {
  idle: ['understanding', 'error'],
  understanding: ['executing', 'responding', 'awaiting_followup', 'error'],
  executing: ['responding', 'awaiting_followup', 'error'],
  responding: ['idle', 'error'],
  awaiting_followup: ['understanding', 'idle', 'error'],
  error: ['idle'],
};

export function canTransition(from: AgentState, to: AgentState): boolean {
  return AgentStateTransitions[from]?.includes(to) ?? false;
}

export type Intent =
  | { type: 'greeting' }
  | { type: 'slash_command'; command: string; arg: string }
  | { type: 'menu_show' }
  | { type: 'menu_choice'; number: number }
  | { type: 'question'; topic: string }
  | { type: 'request_skill'; skillId: string; entities: Record<string, string> }
  | { type: 'follow_up'; refersTo: string }
  | { type: 'chitchat' }
  | { type: 'unknown'; confidence: number };

export type SkillParameterType = 'string' | 'number' | 'boolean' | 'entity';

export interface SkillParameter {
  name: string;
  type: SkillParameterType;
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

export type SkillExecutor =
  | { type: 'inline'; handler: string }
  | { type: 'taskforge'; tasks: TaskforgeTaskSpec[]; goal?: string }
  | { type: 'http'; url: string; method: 'GET' | 'POST'; headers?: Record<string, string> }
  | { type: 'process'; flowId: string }
  | { type: 'script'; code: string; language?: 'js' | 'ts' };

export interface TaskforgeTaskSpec {
  id: string;
  type: 'collect' | 'analyze' | 'outline' | 'write' | 'review' | 'assemble';
  title: string;
  description: string;
  depends_on?: string[];
}

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  parameters: SkillParameter[];
  executor: SkillExecutor;
  timeoutMs?: number;
  requiresContext?: string[];
  enabled?: boolean;
}

export type MessageRole = 'user' | 'agent' | 'system';

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface PendingTask {
  skillId: string;
  taskforgePlanId?: string;
  startedAt: number;
  ackMessageId?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  channelId: string;
  state: AgentState;
  intent?: Intent;
  history: ConversationMessage[];
  context: Record<string, unknown>;
  pendingTask?: PendingTask;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface ConversationConfig {
  historyLimit: number;
  ttlSeconds: number;
  keyPrefix: string;
}

export const DefaultConversationConfig: ConversationConfig = {
  historyLimit: 50,
  ttlSeconds: 604800,
  keyPrefix: 'sam:conv:',
};

export type IntentClassificationResult = {
  intent: Intent;
  raw: string;
  latencyMs: number;
};

export interface SkillExecutionResult {
  ok: boolean;
  output: string;
  artifacts?: Record<string, unknown>;
  error?: string;
}

export interface SkillMatchResult {
  skill: SkillManifest;
  confidence: number;
  matchedTrigger: string;
}

export interface AgentContext {
  conversation: Conversation;
  config: ConversationConfig;
}