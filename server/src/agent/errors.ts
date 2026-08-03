// sam LINE Agent — Error Code 體系
//
// 所有 agent 層錯誤都應使用 AgentError，方便：
//   - 統一記錄 logs
//   - 統一轉譯為使用者可讀訊息
//   - 區分可恢復 / 不可恢復 / 該 fallback 哪裡

export type AgentErrorCode =
  | 'STATE_INVALID_TRANSITION'
  | 'STATE_CONVERSATION_NOT_FOUND'
  | 'STATE_CONVERSATION_EXPIRED'
  | 'INTENT_CLASSIFICATION_TIMEOUT'
  | 'INTENT_CLASSIFICATION_FAILED'
  | 'INTENT_LOW_CONFIDENCE'
  | 'SKILL_NOT_FOUND'
  | 'SKILL_DISABLED'
  | 'SKILL_EXECUTION_TIMEOUT'
  | 'SKILL_EXECUTION_FAILED'
  | 'SKILL_MISSING_PARAMETERS'
  | 'TASKFORGE_API_ERROR'
  | 'TASKFORGE_PLAN_TIMEOUT'
  | 'REDIS_CONNECTION_ERROR'
  | 'REDIS_OPERATION_ERROR'
  | 'LINE_API_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export type AgentErrorSeverity = 'recoverable' | 'degraded' | 'fatal';

export interface AgentErrorOptions {
  cause?: unknown;
  context?: Record<string, unknown>;
  userMessage?: string;
}

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly severity: AgentErrorSeverity;
  readonly context: Record<string, unknown>;
  readonly userMessage: string;
  readonly cause?: unknown;

  constructor(code: AgentErrorCode, message: string, options: AgentErrorOptions = {}) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.context = options.context ?? {};
    this.cause = options.cause;
    this.userMessage = options.userMessage ?? defaultUserMessage(code);

    const severityByCode: Record<AgentErrorCode, AgentErrorSeverity> = {
      STATE_INVALID_TRANSITION: 'fatal',
      STATE_CONVERSATION_NOT_FOUND: 'recoverable',
      STATE_CONVERSATION_EXPIRED: 'recoverable',
      INTENT_CLASSIFICATION_TIMEOUT: 'degraded',
      INTENT_CLASSIFICATION_FAILED: 'degraded',
      INTENT_LOW_CONFIDENCE: 'recoverable',
      SKILL_NOT_FOUND: 'recoverable',
      SKILL_DISABLED: 'recoverable',
      SKILL_EXECUTION_TIMEOUT: 'degraded',
      SKILL_EXECUTION_FAILED: 'degraded',
      SKILL_MISSING_PARAMETERS: 'recoverable',
      TASKFORGE_API_ERROR: 'degraded',
      TASKFORGE_PLAN_TIMEOUT: 'degraded',
      REDIS_CONNECTION_ERROR: 'fatal',
      REDIS_OPERATION_ERROR: 'degraded',
      LINE_API_ERROR: 'degraded',
      RATE_LIMIT_EXCEEDED: 'recoverable',
      INTERNAL_ERROR: 'fatal',
    };
    this.severity = severityByCode[code] ?? 'degraded';
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
      stack: this.stack,
    };
  }
}

function defaultUserMessage(code: AgentErrorCode): string {
  const map: Record<AgentErrorCode, string> = {
    STATE_INVALID_TRANSITION: '系統狀態錯誤，請稍後再試。',
    STATE_CONVERSATION_NOT_FOUND: '找不到對話紀錄，我幫你重新開始。',
    STATE_CONVERSATION_EXPIRED: '對話已過期，我幫你重新開始。',
    INTENT_CLASSIFICATION_TIMEOUT: '我想了一下沒想清楚，可以換個方式問我嗎？',
    INTENT_CLASSIFICATION_FAILED: '我沒理解你的意思，可以換個方式問我嗎？',
    INTENT_LOW_CONFIDENCE: '我不太確定你想問什麼，可以更具體一點嗎？',
    SKILL_NOT_FOUND: '我目前還不會這件事，但可以幫你問問看。',
    SKILL_DISABLED: '這個功能目前沒有開啟，請聯絡管理員。',
    SKILL_EXECUTION_TIMEOUT: '處理時間過長，請稍後再試。',
    SKILL_EXECUTION_FAILED: '執行時發生錯誤，請稍後再試。',
    SKILL_MISSING_PARAMETERS: '需要更多資訊才能處理，請補充細節。',
    TASKFORGE_API_ERROR: '子任務引擎連線異常，請稍後再試。',
    TASKFORGE_PLAN_TIMEOUT: '子任務處理時間過長，請稍後再試。',
    REDIS_CONNECTION_ERROR: '狀態儲存異常，請稍後再試。',
    REDIS_OPERATION_ERROR: '狀態更新失敗，請稍後再試。',
    LINE_API_ERROR: '訊息回傳失敗，請稍後再試。',
    RATE_LIMIT_EXCEEDED: '訊息頻率過高，請稍候一分鐘再試。',
    INTERNAL_ERROR: '系統發生未預期錯誤，請稍後再試。',
  };
  return map[code];
}

export function isAgentError(e: unknown): e is AgentError {
  return e instanceof AgentError;
}

export function toAgentError(e: unknown, fallbackCode: AgentErrorCode = 'INTERNAL_ERROR'): AgentError {
  if (isAgentError(e)) return e;
  if (e instanceof Error) {
    return new AgentError(fallbackCode, e.message, { cause: e });
  }
  return new AgentError(fallbackCode, String(e), { cause: e });
}