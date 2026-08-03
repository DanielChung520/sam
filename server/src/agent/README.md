# sam LINE Agent Layer

> 將 LINE webhook 從「無狀態 dispatcher」升級為「有狀態的 agent」

## 模組結構

```
server/src/agent/
├── types.ts              # AgentState / Intent / Conversation / SkillManifest
├── errors.ts             # AgentError class + 18 種 error codes
├── stateStore.ts         # Redis CRUD（TTL 30 min）
├── llmClient.ts          # chatCompletion（dllm fallback）
├── intentClassifier.ts   # regex 快路 + LLM 慢路（雙語）
├── prompts/
│   └── intentClassifier.ts   # system prompt + 12 few-shot examples
├── skillRegistry.ts      # 載入 + match intent → skill
├── skillExecutor.ts      # inline / taskforge / http 三種 executor
├── skills/manifests/     # 5 個內建 skills
│   ├── greeting.ts       # 打招呼
│   ├── slashCommand.ts   # 斜線指令
│   ├── webSearch.ts      # /search → taskforge collect
│   ├── analyze.ts        # /analysis → collect+analyze
│   └── write.ts          # /write → 完整 6-task 寫作 pipeline
├── agent.ts              # 主類別 + state machine
├── responseFormatter.ts  # LINE 訊息分段（4500 chars/chunk）
├── rateLimiter.ts        # Redis fixed-window（30/min/user）
└── logger.ts             # Structured JSON logs
```

## 訊息流向

```
LINE user
  │
  ▼
webhook.ts ──────────┐
  │                 │
  ▼                 │
RateLimiter.check() │
  │                 │
  ▼                 │
Agent.handleMessage() ──┐
  │                     │
  ├─ stateStore.getOrCreate  ─→ Redis
  ├─ classifyIntent          ─→ regex 或 LLM
  ├─ skillRegistry.match     ─→ manifest
  ├─ skillExecutor.execute   ─→ inline / taskforge / http
  └─ responseFormatter.format ─→ chunked LINE messages
                      │
                      ▼
                replyMessage()
```

## State Machine

```
IDLE
  ↓ new message
UNDERSTANDING
  ↓ classify
EXECUTING ──────────┐
  ↓ done            │
RESPONDING ←─────────┤
  ↓ sent            │
IDLE ←───────────────┘
  ↓ error
ERROR → IDLE
```

所有合法 transitions 定義在 `types.ts:AgentStateTransitions`。
非法轉換會被 `canTransition()` 擋下，回傳 `STATE_INVALID_TRANSITION` error。

## Skill Manifest 格式

```typescript
{
  id: 'web-search',
  name: '網路搜尋',
  description: '搜尋網路資料並用 LLM 整理',
  triggers: ['search', '查詢'],
  parameters: [
    { name: 'query', type: 'string', required: true, description: '搜尋關鍵字' }
  ],
  executor: {
    type: 'taskforge',
    tasks: [
      { id: 'T1', type: 'collect', title: '網路搜尋', description: '...' }
    ]
  },
  timeoutMs: 120_000,
}
```

三種 executor type：
- `inline` — 內部 handler，需 `registerInlineHandler(name, fn)`
- `taskforge` — 呼叫 taskforge API（自動建 plan → execute → poll）
- `http` — 外部 HTTP API

## Intent 類型

| type | 觸發 | routing |
|------|------|---------|
| `greeting` | 你好、hi | greeting skill |
| `slash_command` | `/xxx` | regex fast-path → 對應 skill |
| `question` | X 是什麼 | fallback（需更多 context）|
| `request_skill` | 幫我查 X | 對應 skillId |
| `follow_up` | 那個、再說 | fallback（澄清）|
| `chitchat` | 哈哈、謝謝 | friendly ack |
| `unknown` | 信心度 < 0.6 | fallback |

信心度門檻：`LOW_CONFIDENCE_THRESHOLD = 0.6`

## Error Codes

| Code | Severity | User Message |
|------|----------|--------------|
| `STATE_INVALID_TRANSITION` | fatal | 系統狀態錯誤，請稍後再試。|
| `STATE_CONVERSATION_NOT_FOUND` | recoverable | 找不到對話紀錄，我幫你重新開始。|
| `INTENT_CLASSIFICATION_TIMEOUT` | degraded | 我想了一下沒想清楚，可以換個方式問我嗎？|
| `INTENT_CLASSIFICATION_FAILED` | degraded | 我沒理解你的意思，可以換個方式問我嗎？|
| `INTENT_LOW_CONFIDENCE` | recoverable | 我不太確定你想問什麼，可以更具體一點嗎？|
| `SKILL_NOT_FOUND` | recoverable | 我目前還不會這件事，但可以幫你問問看。|
| `SKILL_DISABLED` | recoverable | 這個功能目前沒有開啟，請聯絡管理員。|
| `SKILL_EXECUTION_TIMEOUT` | degraded | 處理時間過長，請稍後再試。|
| `SKILL_EXECUTION_FAILED` | degraded | 執行時發生錯誤，請稍後再試。|
| `RATE_LIMIT_EXCEEDED` | recoverable | 訊息頻率過高，請稍候一分鐘再試。|

完整列表：`errors.ts:defaultUserMessage`

## 環境變數

```bash
REDIS_URL=redis://localhost:6379/0        # 對話狀態
TASKFORGE_BASE_URL=http://localhost:9900  # sub-agent engine
LLM_API_KEY=                               # 留空自動讀 ~/.dllm/config.json
LLM_API_BASE=https://dllm.aiconn.ai/v1
LLM_MODEL=Qwen3-8B-AWQ
LOG_LEVEL=info                              # debug|info|warn|error
AGENT_TTL_SECONDS=1800                      # 對話 TTL
AGENT_HISTORY_LIMIT=20                      # 訊息歷史上限
```

## 測試

```bash
# Deterministic（regex + JSON extraction）
npx tsx test-intent.mts

# Live LLM（需 dllm 環境）
RUN_LLM_TESTS=1 LLM_MODEL=Qwen3-8B-AWQ npx tsx test-intent.mts

# State store（Redis CRUD + TTL）
npx tsx test-statestore.mts

# 完整 E2E（5 turns + rate limiter）
LLM_MODEL=Qwen3-8B-AWQ npx tsx test-e2e.mts
```

## 計劃與決策紀錄

完整計畫：`/home/daniel/github/sam/.omo/plans/sam-agent-layer.md`
設計討論見 commit 歷史與 hermes 記憶。