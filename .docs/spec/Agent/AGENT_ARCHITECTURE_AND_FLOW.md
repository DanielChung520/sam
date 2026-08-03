# sam Agent 架構與流程 — 核心設計

> 版本：v0.1
> 日期：2026-07-30
> 狀態：**草案，待 user 確認後實作**
> 目的：定義「客戶傳訊息後發生什麼事」— 主 Agent 與 Sub-Agent 的協作流程

---

## 0. 設計原則

1. **單一入口**：所有 webhook 訊息都先進 **Polaris**（對話編排）
2. **可降級**：複雜任務失敗時可退回簡單回應，不卡住客戶
3. **可觀測**：每一步都有 state、log、metric，方便 debug
4. **可中斷**：客戶可隨時取消當前任務
5. **可澄清**：低信心時主動反問，不硬猜

---

## 1. 角色與職責矩陣

### 1.1 主 Agent

| 名字 | 角色 | 何時啟動 | 核心能力 |
|------|------|---------|---------|
| **Polaris** | 對話編排 | **永遠**（所有 webhook 入口）| 意圖分類、決策路由、回應組合 |
| **Sirius** | 任務規劃 | Polaris 判斷「複雜任務」 | DAG 拆解、sub-agent 編排 |
| **Vega** | 品質觀察 | Polaris 判斷「高價值對話」 | 事實/語氣/邏輯檢查 |
| **Altair** | 記憶管理 | 每輪對話結束 | context 萃取、過期清理 |
| **Deneb** | 深度諮詢 | Polaris 判斷「無標準答案」 | 多角度分析、反問釐清 |

### 1.2 Sub-Agent（被 Sirius 編排）

| 名字 | 取代 taskforge | 何時調用 |
|------|---------------|---------|
| **Rigel** | `collect` | 任何需要外部資料的第一步 |
| **Capella** | （新增） | 對 Rigel 結果做交叉驗證 |
| **Betelgeuse** | `analyze` | 需要從資料萃取洞察 |
| **Aldebaran** | `outline` | 進入創作階段時先定結構 |
| **Spica** | `write` | 實際撰寫內容 |
| **Antares** | `review` | 對 Spica 初稿做品質檢查 |
| **Arcturus** | `assemble` | 組裝最終交付物 |

---

## 2. 客戶訊息的完整流程（核心）

```
客戶傳訊息
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: RECEIVE                                              │
│                                                              │
│  webhook → Express server                                    │
│  1. 查 channelId → businessOwnerId + agentKey（Polaris）     │
│  2. 載入 conversation（Redis: sam:conv:{channelId}:{convId}）│
│  3. 載入 customer memory（Altair）                            │
│  4. State: IDLE → RECEIVED                                    │
│  5. 訊息加入 conversation.messages[]                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: UNDERSTAND                                           │
│                                                              │
│  Polaris 跑意圖分類：                                         │
│  ┌─────────────────────────────────────────┐                │
│  │ 1. Regex 快路                            │                │
│  │    比對 triggers：greeting、menu、help    │                │
│  │    命中 → 跳到 Phase 4 (簡單意圖)         │                │
│  └─────────────────────────────────────────┘                │
│  ┌─────────────────────────────────────────┐                │
│  │ 2. LLM 慢路                              │                │
│  │    使用 prompts.intentClassifier          │                │
│  │    輸出：{ intent, confidence, entities }│                │
│  └─────────────────────────────────────────┘                │
│                                                              │
│  決策分支：                                                   │
│  • confidence >= 0.8 + intent 在 skills whitelist            │
│     → Phase 4 (直接調 skill)                                 │
│  • confidence >= 0.5 + 判定為「複雜任務」                     │
│     → Phase 3 (委派 Sirius 規劃)                             │
│  • confidence < 0.5                                           │
│     → Phase 3.5 (反問釐清)                                   │
│  • intent = 'out_of_scope'                                   │
│     → Phase 5 (委派 Deneb 深度回答)                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: PLAN（複雜任務才走）                                 │
│                                                              │
│  Polaris 委派 Sirius：                                        │
│  1. Sirius 接收：goal + context + available sub-agents        │
│  2. Sirius 用 prompts.planner 拆解成 DAG                     │
│  3. 每個 task 指定：                                          │
│     - sub-agent（白名單內）                                  │
│     - input（從上個 task 的 output）                          │
│     - depends_on（前置任務）                                  │
│  4. 範例產出：                                                │
│     Rigel(collect) → Betelgeuse(analyze)                     │
│       → Aldebaran(outline) → Spica(write)                    │
│       ↕                                                      │
│       Capella(verify)                                         │
│       → Antares(review) → Arcturus(assemble)                 │
│  5. Plan 寫入 conversation.executionPlan                      │
│  6. State: PLANNING → EXECUTING                              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3.5: CLARIFY（低信心才走）                              │
│                                                              │
│  Polaris 用 prompts.clarification 生成反問：                 │
│  - 一次只問一個問題                                           │
│  - 提供 2-3 個選項或請客戶補充                                │
│  - State: AWAITING_CLARIFICATION                              │
│  - 客戶回應後：回到 Phase 2 重新分類                          │
│  - clarificationRound++                                      │
│  - 超過 maxClarificationRounds（預設 2）                     │
│     → 退回 best guess 或 ESCALATE                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: EXECUTE                                              │
│                                                              │
│  依決策執行：                                                 │
│  ┌──────────────────────────────────────────┐                │
│  │ A. 簡單意圖（Phase 2 直接命中）            │                │
│  │    - 調 skill（sync）                     │                │
│  │    - 例：greeting、menu、help             │                │
│  │    - 結果直接進 Phase 5                    │                │
│  └──────────────────────────────────────────┘                │
│  ┌──────────────────────────────────────────┐                │
│  │ B. 複雜任務（有 Plan）                    │                │
│  │    - 依 DAG 順序執行                      │                │
│  │    - 每個 task 呼叫 sub-agent             │                │
│  │      （taskforge plan API / MCP）         │                │
│  │    - task 結果寫入 plan.results           │                │
│  │    - State: EXECUTING                     │                │
│  │    - 每完成一個 task 寫 executionLog      │                │
│  │                                              │                │
│  │  錯誤處理（每個 task 都有 try/catch）：       │                │
│  │    - retry policy（預設 1 次）              │                │
│  │    - 仍失敗：標記 task failed               │                │
│  │    - Plan 失敗：跳到 ESCALATE              │                │
│  └──────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4.5: QUALITY_CHECK（可選）                              │
│                                                              │
│  Polaris 判斷是否需要 Vega 審查：                              │
│  - 高價值對話（涉及金額、個資、合約）                          │
│  - 設定 enableQualityCheck = true                            │
│  - 上游 Sub-Agent 有 Antares 失敗                             │
│                                                              │
│  流程：                                                       │
│  1. 把 draft response + context 給 Vega                      │
│  2. Vega 檢查：事實 / 語氣 / 邏輯 / 遺漏                      │
│  3. 輸出：{ pass, issues[], suggestions[] }                   │
│  4. 如果 pass → 進 Phase 5                                    │
│  5. 如果 issues[] 不為空 → 退回 Polaris 修正                  │
│     - 最多 retryQualityCheck 次（預設 1）                     │
│     - 仍失敗：發 draft + Vega 警告註記                        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: RESPOND                                             │
│                                                              │
│  Polaris 組合最終回應：                                       │
│  1. 簡單意圖：直接用 skill 輸出                               │
│  2. 複雜任務：用 Arcturus 組裝的成品                          │
│  3. 深度諮詢：Deneb 的多角度分析                              │
│  4. 加上對話風格：                                            │
│     - 用 customer.memoryRefs 注入偏好                        │
│     - 用 prompts.main 控制語氣                                │
│  5. 透過 LINE webhook 回傳                                    │
│  6. State: RESPONDING → DONE                                  │
│  7. 訊息加入 conversation.messages[]                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 6: MEMORIZE（非同步，不阻塞客戶回應）                    │
│                                                              │
│  Altair 在背景執行：                                          │
│  1. 從這輪對話萃取：                                          │
│     - 新偏好（過敏、口味、預算）                              │
│     - 重要事件（生日、上次需求）                              │
│     - 互動風格（簡潔/詳細/客氣/直接）                        │
│  2. 寫入 memories collection                                  │
│  3. 清理過時或矛盾的舊記憶                                    │
│  4. 隱私過濾：不存電話/地址/身分證                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
DONE
```

---

## 3. 狀態機（State Machine）

### 3.1 Conversation States

```
        ┌──────┐
        │ IDLE │ ←─── 過期清理 / 新對話開始
        └──┬───┘
           │ 訊息到達
           ▼
       ┌─────────┐
   ┌──→│RECEIVED │
   │   └────┬────┘
   │        │
   │        ▼
   │   ┌─────────────┐
   │   │UNDERSTANDING│
   │   └────┬────────┘
   │        │
   │   ┌────┴────────────┬──────────────┐
   │   │                 │              │
   │   ▼ (簡單)          ▼ (複雜)       ▼ (低信心)
   │ ┌──────┐       ┌────────┐    ┌─────────────────┐
   │ │READY │       │PLANNING│    │AWAITING_CLARIFY │
   │ └──┬───┘       └───┬────┘    └────────┬────────┘
   │    │               │                  │
   │    │               ▼                  │ 客戶回應
   │    │          ┌──────────┐             │
   │    │          │EXECUTING │             │
   │    │          └────┬─────┘             │
   │    │               │                  │
   │    │          ┌────┴─────┐             │
   │    │          │          │             │
   │    │          ▼ (通過)   ▼ (失敗)       │
   │    │     ┌──────────┐ ┌─────────┐      │
   │    │     │QUALITY_* │ │ESCALATED│      │
   │    │     └────┬─────┘ └────┬────┘      │
   │    │          │            │           │
   │    │          ▼            ▼           │
   │    │     ┌──────────┐ ┌─────────┐      │
   │    └─────┤RESPONDING│ │ RESPOND │      │ (回錯誤訊息)
   │          └────┬─────┘ │ (錯誤版) │      │
   │               │       └─────────┘      │
   │               ▼                         │
   │          ┌──────┐                       │
   │          │ DONE │                       │
   │          └──┬───┘                       │
   │             │ TTL 過期 / Altair 清理    │
   │             ▼                           │
   │          ┌──────┐                       │
   └──────────│ IDLE │ ←─────────────────────┘
              └──────┘
```

### 3.2 狀態定義

| State | 持續時間 | 說明 |
|-------|---------|------|
| `IDLE` | 永久（直到 TTL 過期）| 對話暫存於 Redis，等待下一則訊息 |
| `RECEIVED` | < 100ms | 訊息已收到，準備進入理解 |
| `UNDERSTANDING` | 200-2000ms | 跑意圖分類 |
| `PLANNING` | 500-3000ms | Sirius 拆解任務 |
| `AWAITING_CLARIFY` | **客戶決定**（最長 5 分鐘超時）| 等待客戶回應反問 |
| `EXECUTING` | 1-60 秒（視任務複雜度）| 執行 plan DAG |
| `QUALITY_CHECK` | 500-2000ms | Vega 審查 |
| `RESPONDING` | < 500ms | 組合 + 發送回應 |
| `DONE` | 永久（直到 TTL 過期）| 本輪完成 |
| `ESCALATED` | 永久（直到人工處理）| 任務失敗，需人工介入 |

### 3.3 失敗處理決策樹

```
EXECUTING 中 task 失敗
  ├─ retry 次數未滿 → 重試
  ├─ retry 用盡：
  │   ├─ 該 task 標記為 optional？
  │   │   ├─ 是 → 繼續執行（用空值）
  │   │   └─ 否 → Plan 失敗
  │   └─ Plan 失敗：
  │       ├─ 已有部分結果？
  │       │   ├─ 是 → 發部分結果 + 道歉訊息
  │       │   └─ 否 → 發通用錯誤訊息
  │       └─ 通知業務員（webhook / SSE）
  └─ 任一 task 成功 → 繼續
```

---

## 4. 資料模型

### 4.1 Conversation（Redis 主存）

```typescript
interface Conversation {
  _key: string              // 'conv:{channelId}:{customerId}'
  channelId: string
  customerId: string        // Person Token（去識別化）
  agentKey: string          // 哪個 Polaris 處理

  state: ConversationState  // 見 3.2

  // 意圖歷史（最近 5 輪）
  intentHistory: Array<{
    intent: string
    confidence: number
    entities: Record<string, any>
    at: number
  }>

  // 當前 plan（如有）
  executionPlan?: {
    planId: string          // taskforge plan_id
    goal: string
    tasks: PlanTask[]
    status: 'pending' | 'running' | 'completed' | 'failed'
    startedAt: number
    completedAt?: number
  }

  // 反問計數
  clarificationRound: number

  // 對話訊息（最近 20 則，超過 archive 到 ArangoDB）
  messages: Array<{
    role: 'user' | 'agent' | 'system'
    content: string
    at: number
    intent?: string
    taskIds?: string[]      // 哪幾個 sub-agent 產生
  }>

  // 客戶記憶 refs（指向 Altair 寫的 memories）
  memoryRefs: string[]

  // Session TTL
  ttl: number               // epoch ms
  createdAt: number
  updatedAt: number
}

type ConversationState =
  | 'IDLE' | 'RECEIVED' | 'UNDERSTANDING' | 'PLANNING'
  | 'AWAITING_CLARIFY' | 'EXECUTING' | 'QUALITY_CHECK'
  | 'RESPONDING' | 'DONE' | 'ESCALATED'
```

### 4.2 PlanTask（taskforge 對齊）

```typescript
interface PlanTask {
  taskId: string
  type: 'collect' | 'analyze' | 'outline' | 'write' | 'review' | 'assemble' | 'verify'
  subAgent: string          // 'Rigel' | 'Betelgeuse' | ...
  input: Record<string, any>
  dependsOn: string[]       // 其他 taskId
  status: 'pending' | 'running' | 'completed' | 'failed'
  output?: any
  error?: string
  startedAt?: number
  completedAt?: number
}
```

### 4.3 Memory（Altair 寫入，ArangoDB）

```typescript
interface Memory {
  _key: string              // 'mem:{customerId}:{timestamp}'
  customerId: string        // Person Token
  channelId: string
  category: 'preference' | 'event' | 'style' | 'history'
  content: string
  evidence: string          // 對話片段來源
  confidence: number        // 0-1（Altair 自評）
  expiresAt?: number        // 部分記憶會過期
  createdAt: number
  supersededBy?: string     // 被新記憶取代時指向新 _key
}
```

### 4.4 ExecutionLog（ArangoDB，長期保存）

```typescript
interface ExecutionLog {
  _key: string              // 'log:{conversationId}:{messageIndex}'
  conversationId: string
  channelId: string
  agentKey: string

  // 本輪所有 task
  tasks: Array<{
    taskId: string
    subAgent: string
    status: string
    durationMs: number
    inputSize: number
    outputSize: number
    error?: string
  }>

  // 總體指標
  totalDurationMs: number
  totalTokens: number       // 估算
  successRate: number

  // 元資料
  startedAt: number
  completedAt: number
}
```

---

## 5. 跨層資料流（從 webhook 到回應）

```
LINE User
   │
   │ webhook event
   ▼
┌──────────────────────────────────────────────────────────┐
│ Express server (port 9091)                                │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 1. webhook handler                                 │   │
│ │    - 驗 LINE signature                             │   │
│ │    - 查 channelId → businessOwnerId + Polaris     │   │
│ │    - 寫入 conversation (Redis)                     │   │
│ │    - 非同步觸發 Agent pipeline                     │   │
│ └─────────────────┬──────────────────────────────────┘   │
│                   │                                       │
│                   ▼                                       │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 2. Polaris pipeline                                │   │
│ │    Phase 1: RECEIVE                                │   │
│ │    Phase 2: UNDERSTAND (regex → LLM classifier)    │   │
│ │    Phase 3: PLAN (Sirius, if complex)              │   │
│ │    Phase 4: EXECUTE                                │   │
│ │      ├─ skill registry lookup                      │   │
│ │      ├─ sub-agent → taskforge (port 9900)         │   │
│ │      └─ MCP tool call                              │   │
│ │    Phase 5: RESPOND                                │   │
│ │    Phase 6: MEMORIZE (background, Altair)          │   │
│ └─────────────────┬──────────────────────────────────┘   │
│                   │                                       │
│                   ▼                                       │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 3. LINE reply API                                  │   │
│    透過業務員的 channel access token                   │   │
└──────────────────────────────────────────────────────────┘
   │
   │ LINE message
   ▼
LINE User
```

---

## 6. 與現有架構對齊

| 既有概念 | 對應到新設計 |
|---------|------------|
| `server/src/agent/agent.ts` | **Polaris pipeline**（從單一 class 改成 orchestration） |
| `server/src/agent/skillRegistry.ts` | 不變 — Polaris 在 Phase 4 仍用 registry |
| `server/src/agent/skillExecutor.ts` | 不變 — Phase 4 同步調用 |
| `server/src/agent/skills/manifests/*.ts` | 不變 — skill 仍是 stateless procedure |
| `taskforge` | **Sirius + Sub-Agent 編排層**（Polaris 透過 taskforge API 呼叫） |
| `agents` collection | **5 個主 Agent 的設定**（Polaris/Sirius/Vega/Altair/Deneb 各一個 instance）|
| `channels` collection | 不變 — 每個 channel.linkedAgentKey 指向 Polaris |

---

## 7. 實作優先序（資料 + 流程）

| # | 工作 | 工作量 | 影響 |
|---|------|--------|------|
| **F1** | 5 個主 Agent 預設設定（prompts、whitelists、behavior knobs）| 1 天 | Polaris 可啟動 |
| **F2** | 7 個 sub-agent 預設 plan templates（含 DAG）| 1 天 | Sirius 可編排 |
| **F3** | Conversation state machine 實作（Polaris pipeline）| 2 天 | 核心流程 |
| **F4** | Redis schema + TTL + archive to ArangoDB | 1 天 | Session 管理 |
| **F5** | Altair 記憶萃取 + 寫入 + 清理 | 1 天 | 跨 session context |
| **F6** | Vega 品質審查觸發邏輯 + retry | 0.5 天 | 高價值對話保護 |
| **F7** | ExecutionLog 寫入 + 統計 | 0.5 天 | 可觀測性 |
| **F8** | Admin 對齊（AgentDetail 顯示 persona + 啟用 sub-agents）| 1 天 | UI |
| **F9** | Playwright + 整合測試（覆蓋所有 phase + 失敗情境）| 1 天 | 品質 |

**總計約 9 天**，分三輪：

- **第一輪**（F1 + F2 + F8）：資料 + UI 對齊 — **可立刻開始**
- **第二輪**（F3 + F4）：核心 pipeline + session
- **第三輪**（F5 + F6 + F7 + F9）：記憶 + 品質 + 可觀測 + 測試

---

## 8. 待 user 確認問題

1. **State machine 完整性**：11 個狀態夠嗎？需要新增嗎？
2. **失敗處理策略**：retry 1 次後直接降級，還是要 3 次？哪些 sub-agent 標 optional？
3. **品質審查觸發條件**：除了「高價值對話」，要不要加「客戶明顯不滿意」自動觸發？
4. **記憶保留期**：預設 90 天？永久？客戶可控？
5. **Phase 6 背景化**：Altair 萃取記憶要立刻同步還是 queue 起來？

---

## 9. 變更紀錄

| 日期 | 變更 |
|------|------|
| 2026-07-30 | 初版，定義 11 狀態 + 6 phase + 跨層資料流 |