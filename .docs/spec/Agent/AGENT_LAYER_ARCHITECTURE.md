# sam 整體架構說明

> 最後更新：2026-07-29
> 維護者：Sisyphus / user
> 狀態：草案，待 user 確認後實作

本文件是 sam 平台架構的**單一真相**（single source of truth）。涵蓋：

1. 整體產品架構（LA / Channel / Agent / 多租戶隔離 / SeaweedFS / token URL）
2. Agent Layer（Agent / Skill / Sub-agent / MCP 的分層與命名）
3. Admin 後台重構
4. 實作優先序與待確認問題

---

## 0. 動機

sam LINE 助理平台在擴展時產生三類概念混亂：

1. **架構層面**：「agent」一詞被用於 4 個層次（LINE bot「LA」、server `Agent` 類別、taskforge 的 worker、admin UI 標籤）
2. **功能層面**：「skill」與「sub-agent」界線模糊
3. **管理層面**：admin `skill-catalog.ts` 與 server `skills/manifests/*.ts` 雙 source of truth

加上多租戶需求（業務員多個 LINE channel）尚未完全實作：本文件一併定義清楚。

---

## 1. 整體產品架構（LA / Channel / 多租戶）

### 1.1 核心概念

```
LA（LINE Assistant）= 業務員的分身
   │
   ├── 每個 LA 對應**一個** LINE Channel
   │
   ├── 多個業務員 → 多個 LA → 多個 LINE Channel
   │
   └── 每個 channel 獨立處理單元（AgentInstance）
         │
         ├── Orchestration（系統固定角色，自動綁定）
         ├── Skills（stateless 程序包）
         ├── MCP（protocol，可選）
         └── Sub-agents（taskforge 等）
```

每個 channel 的資料**完全隔離**（Redis key、ArangoDB query、SeaweedFS path 都帶 channelId）。

#### 1.1.1 Channel 建立流程（user 確認 2026-08-03）

```
建立 Channel（admin 填 LINE credential）
  → 系統自動生成 channel_id（UUID）
  → 系統自動綁定 Orchestration Agent（linkedAgentKey = 固定的 orchestration 角色，如 Polaris）
  → 系統自動生成獨立 webhook 路由（/webhook/{channel_id}）
  → 完成 ✅ admin 不需要選擇任何 Agent
```

**設計決策**：
1. **Orchestration 是系統固定角色** — 如同 Sisyphus 是總編排入口，不是 admin 從列表挑選的選項。Channel 建立時自動綁定，`linkedAgentKey` 對 admin 是**唯讀**（顯示而非選擇）。
2. **「授權 Agents」才是 admin 需要決定的** — 額外開放哪些 agent 給此 channel（多選，多對多）。
3. **每個 channel 有獨立 webhook** — LINE 後台可為不同 channel 設定不同 webhook URL（對應 `/webhook/{channel_id}`），或共用 `/webhook` 靠 destination 查詢（兩者皆支援，見 §10.4 Phase W）。
4. **Skills 全開** — skills 是 agent 的能力指導（enabledSkills 白名單），不在 channel 層勾選。

### 1.2 傳遞方式

| 服務 | 域名 | 內部 |
|------|------|------|
| LA App（業務員使用）| `la.aiconn.ai` | proxy:7010 → Express:9091 |
| Admin 後台（管理）| `admla.aiconn.ai` | Vite:7012 |
| 文件分享（公開瀏覽）| `la.aiconn.ai/f/{token}` | Express:9091（token 驗證）|

### 1.3 LA 功能與 Agent 對應

| 功能 | 觸發方向 | Agent 角色 | 狀態 |
|------|---------|-----------|------|
| **答詢**（AI 對話）| customer → bot | 走 webhook → `Agent.handleMessage` | ✅ 已做 |
| **收圖**（名片 OCR）| customer 上傳照片 | Agent 收到 image → OCR skill → 存 SeaweedFS + CRM | 🔲 待做 |
| **群發**（broadcast）| owner → customers | **不過 Agent**，走獨立 broadcast API + cron | ✅ 已做（不走 agent）|

### 1.4 多租戶關鍵設計

#### 1.4.1 Webhook 多 channel 路由

**現狀**（single tenant）：webhook 用 `process.env.LINE_CHANNEL_ACCESS_TOKEN`。

**目標**（multi tenant）：
```
LINE webhook 進來（帶 channelId 或 X-Line-Destination header）
   ↓
查 ArangoDB：channelId → businessOwnerId + access_token + channel_secret
   ↓
用查到的 credential 驗 signature
   ↓
後續所有 conversation / 資料操作帶 channelId 隔離
```

#### 1.4.2 資料隔離（必須強制）

每個資料層都帶 `channelId`：

```
Redis key:    sam:conv:{channelId}:{conversationId}
ArangoDB:     所有 collection 文件必帶 channelId 欄位，查詢一律 filter
SeaweedFS:    /filer/{channelId}/{uuid}.{ext}
```

#### 1.4.3 兩層隔離（channel + person）

依原 spec（init.md §1）有兩層隔離：

| 層級 | 隔離對象 | 機制 |
|------|---------|------|
| **Channel** | 業務員之間 | channelId prefix |
| **Person** | 客戶個資（業務員看不到原始）| Person Token（個資去識別化）|

兩層都要實作。

### 1.5 SeaweedFS + Token URL 設計

文件上傳流程：
```
業務員/Agent 生成文件
  ↓
POST /api/v1/files/upload
  body: { channelId, file, metadata }
  ↓
server 存到 SeaweedFS：/filer/{channelId}/{uuid}.pdf
DB 記錄：file_id, channelId, path, created_at
  ↓
回傳 { file_id, share_url: "https://la.aiconn.ai/f/{token}" }
```

Token 設計（HMAC + expiry）：
```
token = base64url(
  HMAC-SHA256(secret, channelId + file_id + expires_at)
) + "." + expires_at
```

GET `https://la.aiconn.ai/f/{token}`：
1. 解析 expires_at（過期拒絕）
2. 重算 HMAC 比對（防偽）
3. 查 file_id → channelId
4. 從 SeaweedFS stream 出來
5. `Content-Disposition: inline`（瀏覽器）或 `attachment`（下載）

預設時效：7 天，可調。

---

## 2. 正式分層模型

```
┌──────────────────────────────────────────────────────────┐
│ LINE user                                                  │
└────────────┬─────────────────────────────────────────────┘
             │ webhook event
             ▼
┌──────────────────────────────────────────────────────────┐
│ Agent（orchestrator）                                       │
│ - 持有 conversation state（Redis）                          │
│ - 狀態機：IDLE → UNDERSTANDING → EXECUTING → RESPONDING     │
│ - 意圖分類（regex 快路 + LLM 慢路）                          │
│ - 決定「現在該做什麼」（哪個 skill？等參數？結束？）            │
│                                                          │
│ 實作：server/src/agent/agent.ts                            │
└────────────┬─────────────────────────────────────────────┘
             │ invoke skill (sync or async)
             ▼
┌──────────────────────────────────────────────────────────┐
│ Skill（stateless procedure，無狀態程序）                    │
│ - manifest 描述：id / triggers / params / executor           │
│ - executor type:                                            │
│     • inline    → 同步函式（greeting, slash-command, menu）  │
│     • taskforge → 委派給 sub-agent                            │
│     • http      → 外部 API                                    │
│ - 不持有跨呼叫狀態（每次都是 pure function）                  │
│                                                          │
│ 實作：server/src/agent/skills/manifests/*.ts                │
└────────────┬─────────────────────────────────────────────┘
             │ delegate (only taskforge type)
             ▼
┌──────────────────────────────────────────────────────────┐
│ Sub-agent（委派工人，目前 = taskforge plan）                │
│ - 自己的 lifecycle：pending → running → completed/failed     │
│ - 自己的 state：每個 task 有 status / output / retry          │
│ - 異步可輪詢（plan_id 可查進度）                              │
│ - 多個 task 串成 DAG（depends_on）                           │
│ - 透過 taskforge REST API 或 MCP 操控                        │
│                                                          │
│ 實作：taskforge（Go, port 9900）                            │
└────────────┬─────────────────────────────────────────────┘
             │ each task invokes LLM
             ▼
┌──────────────────────────────────────────────────────────┐
│ LLM（dllm 或 openai）                                        │
│ 每個 task 收 description + context，回傳 output              │
│ taskforge 預設讀 ~/.dllm/config.json                        │
└──────────────────────────────────────────────────────────┘

   ▲
   │ (平行 — 不是必經路徑)
┌──────────────────────────────────────────────────────────┐
│ MCP（protocol，可選）                                          │
│ - 把 skill / sub-agent 暴露給外部 agent                       │
│ - 或引入外部 MCP server 的工具                                │
│                                                          │
│ 現況：taskforge 已 expose MCP；sam server 暫無             │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 命名標準

| 詞 | 正式定義 | 實作位置 | 不要混用 |
|---|---|---|---|
| **Agent** | 對話編排者，有狀態 | `server/src/agent/agent.ts` | 不要叫 sub-agent 為「agent」|
| **Skill** | 程序性知識包，stateless | `server/src/agent/skills/manifests/*.ts` | 不要說「skill 是一種 agent」 |
| **Sub-agent** | 被委派的 worker，有自己狀態 | `taskforge` plan（Go） | 不要把 skill 委派出去的對象叫「task」 |
| **Task type** | sub-agent 內部的工作種類 | `collect / analyze / outline / write / review / assemble` | 不要把 task type 跟 skill 混為一談 |
| **MCP** | 傳輸協定 | taskforge 已 expose（`mcp.go`）| MCP 不是 component，是 protocol |
| **LA / 分身** | LINE Bot 對使用者的稱呼 | UI / 行銷用語 | 不要在程式碼註解用 LA |

### 命名對照表（公告用）

| 之前說的 | 現在正式說 |
|---|---|
| 「taskforge 的 collect agent」 | taskforge 的 `collect` task |
| 「web-search 是一個 sub-agent」 | web-search 是 skill，內部委派給 sub-agent |
| 「LINE 分身 agent」 | LINE Bot（程式碼內稱 Agent，UI 可稱分身） |
| 「agent skills」 | Skill（不加 agent 前綴） |
| 「MCP skill」 | Skill 透過 MCP 暴露給外部（不是 skill 種類） |

---

## 4. 目前混亂點修正

### 3.1 taskforge 內部 TaskType

**檔案**：`taskforge/internal/types.ts`

```go
type TaskType =
  | "collect"     // 蒐集資料（sub-agent 預設第一步）
  | "analyze"     // 深度分析
  | "outline"     // 產出大綱
  | "write"       // 撰寫
  | "review"      // 品質檢查
  | "assemble"    // 組裝全文
  | "research"    // LEGACY alias for collect，保留相容性
```

**狀態**：已修。`research` 仍存在但 default plan 改用 `collect + analyze`。

### 3.2 server agent 命名

**狀態**：OK，無需改。

- `SkillManifest.executor.type` 三種類型清楚
- `AgentState` 6 種狀態清楚
- `Intent` 9 種類型清楚（含 `menu_show` / `menu_choice`）

### 3.3 admin skill-catalog 雙 source of truth ⚠️

**問題**：
- `admin/src/data/skill-catalog.ts` 有 5 個 `agent-*` 條目（hardcode 副本）
- 實際定義在 `server/src/agent/skills/manifests/*.ts`
- 改一邊沒改另一邊就 broken
- UI 只讀，無法 enable/disable

**方案**（推薦 C）：

| 方案 | 描述 | 優點 | 缺點 |
|---|---|---|---|
| A | admin 純展示 hardcode | 最簡 | 雙 source of truth |
| B | admin 用 ArangoDB 存 skill | 可 UI 編輯 | 多一層 schema、要 migration |
| **C** | server expose `GET /v1/agent/skills`，admin 從 API 讀 + PATCH | **單 source of truth** | 需新 endpoint |

**方案 C 細節**：

```
GET  /v1/agent/skills
     → 回傳所有 skill manifests（含執行統計：呼叫次數、平均耗時）
GET  /v1/agent/skills/:id
     → 單一 skill 完整 manifest
PATCH /v1/agent/skills/:id
     body: { enabled: boolean }
     → 即時 enable/disable（寫回記憶體中的 registry）
GET  /v1/agent/skills/:id/stats
     → 統計：今日/本週/總計呼叫次數、平均 latency
```

**狀態**：待實作。

### 3.4 MCP 暴露

**現況**：
- taskforge 暴露 MCP（4 個 tools：`create_plan` / `get_plan` / `execute_plan` / `list_plans`）
- sam server 沒有 MCP server

**決策**：暫不為 sam server 加 MCP server。先做 admin 的「MCP Tools 監控頁」展示 taskforge 暴露的工具。

未來有需求時（讓外部 Claude / Cursor 直接調用 sam 的 skill），再加 `server/src/agent/mcpServer.ts`。

---

## 5. Admin 頁面重構

### 4.1 新結構

```
admin/src/pages/
├── Skills.tsx              ← 改：API-driven + toggle
├── SubAgents.tsx           ← 新：taskforge plan 監控
├── McpTools.tsx            ← 新：MCP 工具總覽
└── AgentConfig.tsx         ← 新：LLM / Rate limit / TTL 設定
```

### 4.2 Sidebar 規劃

```
📋 Skills          (skill 總覽)
🤖 Sub-agents      (任務監控)
🔌 MCP Tools       (MCP 工具總覽)
⚙️  Agent Config   (LLM / Rate / TTL)
```

### 4.3 Skills 頁（改造）

**資料來源**：`GET /v1/agent/skills`

**欄位**：
- `id` / `name` / `description`
- `triggers`（chip 顯示）
- `executor.type`（inline / taskforge / http 標示）
- `enabled`（toggle switch）
- `stats.24h.calls` / `stats.24h.avgLatencyMs`

**動作**：
- 點 skill → 開 modal 顯示完整 manifest JSON
- Toggle enable/disable → PATCH 立即生效
- 「重新載入」按鈕 → 強制刷新 registry（用於 server 重啟後）

### 4.4 SubAgents 頁（新增）

**資料來源**：`GET /v1/plans`（taskforge）

**欄位**：
- `plan_id` / `goal` / `status` / `created_at` / `current_task`
- 任務進度條（X / Y tasks completed）
- 預估完成時間

**動作**：
- 點 plan → 顯示所有 task 的 status + output
- Cancel 按鈕（taskforge 不支援 partial cancel，先標記為 "stop polling"）
- 篩選：active / completed / failed

### 4.5 McpTools 頁（新增）

**資料來源**：taskforge MCP endpoint（讀取 tool list）

**欄位**：
- tool name / description / input schema
- 測試呼叫按鈕（呼叫一次並顯示結果）

**狀態**：低優先，4.4 完成後再看。

### 4.6 AgentConfig 頁（新增）

**資料來源**：`GET /v1/agent/config`（新增）

**欄位**：
- LLM provider（dllm / openai）
- Model name
- Max tokens
- Rate limit（每分鐘請求數）
- Conversation TTL（秒）
- History limit

**動作**：
- 編輯後 PATCH（寫回記憶體 + .env 重生）
- ⚠️ 暫不支援即時生效 LLM 切換（需重啟 process）

**狀態**：低優先。

---

## 6. 實作優先序

### 6.1 基礎設施（必須）

| # | 工作 | 工作量 | 價值 | 依賴 |
|---|---|---|---|---|
| **A1** | Multi-channel webhook routing（DB 查 channel credential）| 1.5 天 | 高 | 無 |
| **A2** | 強制 channelId 隔離（Redis key / ArangoDB query / SeaweedFS path）| 1 天 | 高 | A1 |
| **A3** | SeaweedFS client + file upload/download API | 1 天 | 高 | 無 |
| **A4** | Token URL 機制（HMAC + expiry）| 0.5 天 | 高 | A3 |
| **B1** | server 新增 `GET /v1/agent/skills` + `PATCH enable/disable` | 0.5 天 | 高 | 無 |
| **B2** | admin Skills.tsx 改成 API-driven + toggle | 0.5 天 | 高 | B1 |

### 6.2 產品功能（後續）

| # | 工作 | 工作量 | 價值 |
|---|---|---|---|
| C1 | OCR 名片 skill（image 訊息 → OCR → 存 SeaweedFS + CRM）| 1 天 | 中 |
| C2 | admin SubAgents.tsx（taskforge plan 監控）| 1 天 | 中 |
| C3 | admin McpTools.tsx | 0.5 天 | 中 |
| C4 | admin AgentConfig.tsx | 0.5 天 | 低 |

**A 系列 + B 系列** 是 must-have：沒有 A1-A4 就無法多租戶上線；B 系列解決 skill 管理。
**C 系列** 視後續需求排程。

---

## 7. 待 user 確認問題

### 7.1 整體架構（多租戶）

1. **Multi-channel 註冊流程**：業務員怎麼把 LINE channel 接進來？
   - 方案 A：admin 後台手動輸入 channelId + access token（建議，先求有）
   - 方案 B：OAuth flow 自動授權（長期更好但工程量大）

2. **兩層隔離**（channel + person）：
   - channel 隔離（業務員之間）：用 channelId prefix
   - person 隔離（業務員看不到客戶原始個資）：Person Token 去識別化
   - 兩層都要，同意嗎？

3. **文件 token 預設時效**：1 天 / 7 天（建議）/ 30 天 / 永久？

4. **OCR 用哪家**：雲端 API（Google Vision / AWS Textract）/ 本地 OCR（Tesseract）/ 先做 dummy（只存圖，後面再 OCR）？

### 7.2 Agent Layer 管理

5. **方案 C（admin 從 API 讀 skills）**是否採用？或要走 DB 方案 B？

6. **AgentConfig 頁**（LLM/rate limit 即時調整）是否要做？

7. **SubAgents 監控頁**是否實作？業務員會用到嗎？

8. **taskforge 內部 TaskResearch**：保留 legacy alias 還是直接移除？

9. **MCP 暴露**：sam server 是否要變成 MCP server？（目前 taskforge 已 expose，sam 不需要）

---

## 8. 相關檔案

### 現有檔案
- `server/src/agent/agent.ts` — Agent orchestrator
- `server/src/agent/skillRegistry.ts` — Skill manifest loader
- `server/src/agent/skillExecutor.ts` — 3 種 executor
- `server/src/agent/skills/manifests/*.ts` — 5 個內建 skill
- `taskforge/internal/types.go` — TaskType 定義
- `taskforge/internal/mcp.go` — taskforge MCP server
- `admin/src/data/skill-catalog.ts` — admin skill catalog（要改為 API-driven）
- `admin/src/pages/Skills.tsx` — admin Skills 頁

### 待新增檔案
- `server/src/routes/agentSkills.ts` — `/v1/agent/skills` endpoints
- `server/src/routes/agentConfig.ts` — `/v1/agent/config` endpoints
- `admin/src/pages/SubAgents.tsx` — Sub-agent 監控頁
- `admin/src/pages/McpTools.tsx` — MCP 工具頁
- `admin/src/pages/AgentConfig.tsx` — Agent 設定頁

### 相關計劃文件
- `.omo/plans/sam-agent-layer.md` — Agent Layer 完整實作計劃（7 phases）

---

## 9. 擴展性設計（多租戶未來擴展）

> 本章是**前瞻性設計**，確保現有架構不會在多租戶需求出現時需要大爆炸重構。
> 目前**不需要實作**，但要確保未來加新功能時不破壞擴展空間。

### 10.1 兩種未來 scenario

#### Scenario 1：一個帳號、多個 LINE channel（同一業務多觸點）

```
Person A
   ├─ Channel B1（公司 LINE）
   ├─ Channel B2（個人 LINE 商家）
   └─ Channel B3（Facebook 整合 LINE）
       ↓
   同一個 webhook endpoint
       ↓
   ONE Agent（共享）
       ↓
   Data 完全隔離（by channelId）
```

**現狀：✅ 已支援**

- `channels` collection 已有 `businessOwnerId`，一個人可擁多 channel
- 資料隔離是 `channelId` 級，天然支援
- 加新 channel = 插一筆 document，不需改 code

#### Scenario 2：一個帳號、多個業務（每業務有獨立 Agent）

```
Person A
   ├─ Business B（房仲）    → Agent B（不動產專用 prompt + skills）
   ├─ Business C（零售）    → Agent C（零售專用 prompt + skills）
   └─ Business D（顧問）    → Agent D（顧問專用 prompt + skills）
       │
       └─ 每個業務又有多個 LINE channel
```

**現狀：⚠️ Code 支援、Data 不支援**

- Agent class 是 singleton（`getAgent()`）
- Skills 是 global hardcode（5 個內建）
- Prompts 是 hardcode
- 全部 channel 共用同一組設定

### 10.2 已預留的擴展點

| 設計點 | 現狀 | 擴展方式 | 破壞性 |
|--------|------|---------|-------|
| `businessOwnerId` 在 Channel model | ✅ 已有 | 直接用，不需改 | 無 |
| Redis key 已帶 channelId | ✅ 已有 | 加 owner 維度只需再加 prefix | 無 |
| Files path 已帶 channelId | ✅ 已有 | 同上 | 無 |
| Agent 接受外部 config | ✅ 可注入 | 改成 per-business 載入即可 | 小 |
| Skill manifest 結構 | ✅ 已抽象 | 加 `ownerScope` 欄位即可 | 小 |
| BUILTIN_MANIFESTS 是 const 陣列 | 已知 | 改成函式 `loadBuiltinManifests(ownerScope)` | 小 |

### 10.3 三個擴展點的 code shape

#### 擴展點 A：Agent 從 singleton → per-business factory

```typescript
// 現在（singleton）
const agent = getAgent();  // 全 server 一份

// 之後（per-business cache）
export function getAgent(businessOwnerId?: string): Promise<Agent> {
  // 內部 cache：同 ownerId 給同一個 instance
  // 不同 ownerId 給不同 instance，但共享同一份 code
}
```

**核心改動**：
- `Agent.handleMessage()` 接受 `businessOwnerId` 參數
- 內部用 `loadAgentConfig(businessOwnerId)` 讀設定
- `getAgent()` cache map: `Map<businessOwnerId, Agent>`

**為何不破壞現有 API**：呼叫端傳 `businessOwnerId`，agent 內部 cache 同一 owner 的 instance；不傳時 fallback 給 default（維持向後相容）。

#### 擴展點 B：Skills 從 global → per-owner registry

```typescript
// 現在
const skillRegistry = new SkillRegistry();
await skillRegistry.load();  // 載入 BUILTIN_MANIFESTS

// 之後
const skillRegistry = new SkillRegistry();
await skillRegistry.load({
  builtinScope: await loadOwnerScope(businessOwnerId),
  // scope = 'realestate' | 'retail' | 'consulting' | 'all'
  customManifests: await loadCustomManifestsFromDB(businessOwnerId),
  // 從 ArangoDB `skill_overrides` collection 讀自訂 manifest
});
```

**核心改動**：
- `BUILTIN_MANIFESTS` 改成按 scope 分組的 `Map<scope, SkillManifest[]>`
- `load()` 接受參數，決定載入哪些 builtin + 哪些 custom
- 新增 `skill_overrides` collection（key = `ownerId + skillId`）

#### 擴展點 C：Prompts 從 hardcode → DB-loaded with fallback

```typescript
// 現在
const prompt = INTENT_CLASSIFIER_SYSTEM_PROMPT;  // const string

// 之後
async function loadPrompt(businessOwnerId: string, key: string): Promise<string> {
  const cached = await db.collection('prompts').firstExample({ ownerId, key });
  return cached?.content ?? DEFAULT_PROMPTS[key];  // fallback to hardcode
}
```

**核心改動**：
- 新增 `prompts` collection（key = `ownerId + promptKey`）
- `loadPrompt(ownerId, key)` 先查 DB、沒有就用現有 const
- 各 prompt 模組改成 `const prompt = await loadPrompt(ownerId, 'intent-classifier')`

### 10.4 Webhook 路徑擴展（可選）

```typescript
// 現在
POST /webhook               ← 所有 channel 共用

// 之後（per-business webhook URL）
POST /webhook/:businessId   ← LINE 後台可設不同 channel 走不同 URL
```

**核心改動**：
- Router 加 `/:businessId` prefix
- webhook.ts handler 多收一個 `req.params.businessId`
- 內部 channel lookup 改成 `destination` AND `businessId`

**為何可選**：LINE 允許每個 channel 設不同 webhook URL。如果用戶都用同一個 URL（最常見），這個不需要。

### 10.5 遷移路徑

| 階段 | 觸發條件 | 工作量 | 改動範圍 |
|------|---------|--------|---------|
| **現狀** | 一個業務 | — | — |
| **Phase X** | 多 channel 同業務 | ✅ 已做 | A1-A4 + B1-B2 |
| **Phase Y** | 業務有 prompt 差異需求 | 1 天 | 加 `prompts` collection + `loadPrompt()` 函數 |
| **Phase Z** | 業務有 skill 差異需求 | 1.5 天 | `BUILTIN_MANIFESTS` 按 scope 分組 + `skill_overrides` collection |
| **Phase W** | 需要 per-business webhook | 0.5 天 | Router 加 prefix |

**關鍵設計**：每個 phase 都是「加一層」，不改現有 API。

### 10.6 決策樹

```
你的業務之間 prompt 差異大嗎？
├─ 否  → 現狀夠用（單 agent + channelId 隔離）
└─ 是
   ├─ 技能也不同？ → 進 Phase Z（skill overrides）
   ├─ LLM 模型不同？ → 進 Phase Y（prompts + model 欄位）
   └─ 要不同 webhook URL？ → 進 Phase W（path prefix）
```

### 10.7 不要做的事（Anti-patterns）

| ❌ 不要 | ✅ 應該 |
|--------|---------|
| 把 `businessOwnerId` 當成 `channelId` 用 | 兩者分開，channelId 是 LINE channel，ownerId 是 sam 業務 |
| Hardcode 業務特定的 prompt | 全部 prompt 從 const 或 DB 載入 |
| 用 env var 區分業務 | 用 DB + config collection（env 是 deployment-level）|
| 一個 process 多個 port 給不同 agent | 單 process + factory pattern（更易部署）|
| 把 skill 邏輯寫在 webhook.ts | skill 在 manifest + executor，保持 webhook 薄 |

### 10.8 擴展性檢查清單（每次新增功能時）

新增任何 agent 相關功能時，問自己：

- [ ] 這個功能是**全 channel 共享**還是 **per business**？
  - 全共享 → 寫在現有 const / singleton
  - per business → 加 ownerId 參數，從 config 載入
- [ ] 這個 prompt 是 **hardcode 還是可注入**？
  - hardcode → 移到 `DEFAULT_PROMPTS[key]`
  - 可注入 → 走 `loadPrompt(ownerId, key)`
- [ ] 這個 skill 是 **global 還是 conditional**？
  - global → 加到 `BUILTIN_MANIFESTS`
  - conditional → 加 `ownerScope` 或從 DB 載入

---

## 10. Admin UI 詳細規劃

> 本章是 admin 後台（port 7012）的完整 wireframe 與優先序。

### 10.1 資訊架構（sitemap）

```
📊 Dashboard        ← 總覽（任務量、技能使用、錯誤率）
👥 Channels         ← 多租戶 LINE channel 管理
🤖 Agent            ← LLM / Prompt / Rate limit 設定
🛠  Skills          ← Skill 總覽（已有，繼續強化）
📦 Sub-Agents       ← taskforge plan 監控
🔌 MCP Tools        ← 暴露的工具清單
📁 Files            ← 上傳檔案、token 管理
```

### 10.2 各頁 wireframe

#### 10.2.1 Dashboard（總覽）

```
┌─ 📊 Dashboard ───────────────────────────────────────────────────┐
│                                                                 │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                             │
│ │  12  │ │  5   │ │  3   │ │  0%  │                             │
│ │Channels│ │Skills│ │Active│ │Error │                             │
│ │ 活動  │ │啟用中│ │ Sub- │ │rate  │                             │
│ └──────┘ └──────┘ │Agent │ └──────┘                             │
│                  └──────┘                                       │
│                                                                 │
│ ┌── 24h 訊息量 (折線圖) ──┐  ┌── Top Skills (排行榜) ────────┐   │
│ │ ╱╲    ╱╲╱╲           │  │ 1. /search       142 calls    │   │
│ │   ╲╱╲╱    ╲╱╲         │  │ 2. /analysis      87 calls    │   │
│ └─────────────────────┘  │ 3. /write         23 calls    │   │
│                          └──────────────────────────────┘   │
│                                                                 │
│ ┌── 最近錯誤（最近 5 筆）───────────────────────────────┐      │
│ │ 14:23  taskforge timeout  /search 量子計算              │      │
│ │ 14:18  intent classification failed                       │      │
│ └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

**核心 metric 卡片**：channel 數、啟用技能、運行中 sub-agent、24h 錯誤率  
**核心圖表**：24h 訊息量折線圖、Top 技能排行、最近錯誤

#### 10.2.2 Channels（多租戶管理）

```
┌─ 👥 Channels ────────────────────────────────────────────────────┐
│ ┌─ 搜尋 ───────────┐ ┌─ 啟用/停用 ─┐ ┌─ + 新增 Channel ────┐     │
│ └─────────────────┘ └────────────┘ └────────────────────┘     │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 🟢 啟用  | Channel ID: ch_alpha_123                      │    │
│ │ 業務員: 王小明（房仲）                                  │    │
│ │ Channel 名稱: 信義區豪宅                                  │    │
│ │ Tokens: ●●●●●●●●●● 8,234 / 500,000 本月              │    │
│ │ Skills 啟用: greeting, web-search, analyze                │    │
│ │ [編輯] [停用] [查看 SECRET]                              │    │
│ └─────────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 🟡 警告  | Channel ID: ch_beta_456                       │    │
│ │ 業務員: 王小明（零售）                                  │    │
│ │ Tokens: ●●●●●●●●●●●●●●● 467,000 / 500,000 本月         │    │
│ │ ⚠ 接近 LINE 配額上限                                     │    │
│ │ [編輯] [停用]                                            │    │
│ └─────────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ ⚪ 停用  | Channel ID: ch_gamma_789                      │    │
│ │ 業務員: 李大華                                            │    │
│ │ Last active: 3 天前                                       │    │
│ │ [編輯] [啟用] [刪除]                                     │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**狀態色**：🟢 啟用 / 🟡 警告 / 🔴 錯誤 / ⚪ 停用  
**Token 用量視覺化**：progress bar

#### 10.2.3 Agent（設定）

```
┌─ 🤖 Agent Configuration ────────────────────────────────────────┐
│ ┌─ Channel: [信義區豪宅 ▼]  Owner: 王小明（房仲）────────┐    │
│                                                                 │
│ ┌─ LLM Provider ─────────────────────────────────────────┐     │
│ │ Provider: (●) dllm  ( ) openai                         │     │
│ │ API Base: https://dllm.aiconn.ai/v1                    │     │
│ │ Model:    Qwen3-8B-AWQ                          ▼     │     │
│ │ API Key:  ●●●●●●●●●●●●●●●●●●  [顯示]              │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│ ┌─ Prompts ───────────────────────────────────────────────┐     │
│ │ 意圖分類  [展開編輯 ▼]                                  │     │
│ │   "你是 sam LINE 分身的「意圖分類器」..."                │     │
│ │   (450 chars)                              [儲存] [重設] │     │
│ │                                                         │     │
│ │ 收集任務  [展開編輯 ▼]                                  │     │
│ │   "請搜尋並整理「${query}」的最新相關資料..."            │     │
│ │   (240 chars)                              [儲存] [重設] │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│ ┌─ Rate Limit ─────────────────────────────────────────────┐    │
│ │ 每分鐘訊息數: [30  ] / user                              │    │
│ │ Conversation TTL:  [1800] 秒                             │    │
│ │ History 上限:    [ 20 ] 則                               │    │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│ [測試連線] [儲存]                                                │
└─────────────────────────────────────────────────────────────────┘
```

**可摺疊編輯器**避免一進來就是大塊程式碼  
**測試連線按鈕**儲存前先驗證 LLM 設定

#### 10.2.4 Skills（繼續強化）

```
┌─ 🛠 Skills ─────────────────────────────────────────────────────┐
│ ┌─ 🤖 Agent Layer Skills (server 管理) ──────────────────────┐    │
│ │ ┌─ web-search ──────────────────────────────────────┐    │    │
│ │ │ 🟢 啟用 │ taskforge │ ID: web-search              │    │    │
│ │ │ 搜尋網路資料並整理成摘要                          │    │    │
│ │ │ Triggers: search, 查詢, 搜尋                      │    │    │
│ │ │                              [停用] [執行測試] [JSON] │    │    │
│ │ └────────────────────────────────────────────────────┘    │    │
│ │ (其他 4 個 skill 類似)                                    │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ ┌─ 📦 Static Skills (skill-catalog.ts) ─────────────────────┐    │
│ │ ┌─ article-reader ─────────────────────────────────┐     │    │
│ │ │ 🟢 啟用 │ 客服 │                                   │     │    │
│ │ │ 讀取網路文章網址，自動提取內文...                 │     │    │
│ │ │ [編輯 manifest] [執行測試] [流程圖]               │     │    │
│ │ └────────────────────────────────────────────────────┘     │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ [+ 新增 Skill]                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**JSON Drawer**：點 [JSON] 開側邊欄顯示完整 manifest + parameters  
**執行測試**：彈出 input form，執行後顯示 output  
**流程圖**：對有 `hasFlow: true` 的，開 FlowEditor（已有）

#### 10.2.5 Sub-Agents（taskforge 監控）

```
┌─ 📦 Sub-Agents ─────────────────────────────────────────────────┐
│ 篩選: [● 執行中 4] [已完成] [失敗] [全部]                      │
│                                                                 │
│ ┌─ plan_a1b2c3 ─────────────────────────────────────────┐    │
│ │ 🎯 目標: /search 量子計算                             │    │
│ │ Channel: ch_alpha_123  啟動: 2 分鐘前                  │    │
│ │ Tasks: ████░░░░ 4/8 完成                            │    │
│ │ ┌─────────────────────────────────────────────┐    │    │
│ │ │ ✓ T1 collect  完成                            │    │    │
│ │ │ ✓ T2 analyze  完成                            │    │    │
│ │ │ ✓ T3 outline  完成                            │    │    │
│ │ │ ✓ T4 write    完成                            │    │    │
│ │ │ ● T5 review   執行中 12s                      │    │    │
│ │ │ ○ T6 assemble 待執行                          │    │    │
│ │ │ ○ T7 revise   待執行                          │    │    │
│ │ │ ○ T8 final    待執行                          │    │    │
│ │ └─────────────────────────────────────────────┘    │    │
│ │ [查看詳情] [取消]                                       │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**視覺化進度條**：每個 task 的狀態（✓ ● ○）一目了然  
**即時更新**：每 5 秒 poll 一次（或 SSE）  
**取消按鈕**：取消整個 plan（標記 stop_polling）

#### 10.2.6 MCP Tools

```
┌─ 🔌 MCP Tools ──────────────────────────────────────────────────┐
│ ┌─ taskforge ─────────────────────────────────────────────┐    │
│ │ ┌─ create_plan ──────────────────────────────────┐    │    │
│ │ │ 建立 taskforge plan                             │    │    │
│ │ │ Input: { goal: string, tasks?: Task[] }       │    │    │
│ │ │ Calls (24h): 47                                │    │    │
│ │ │ [測試呼叫]                                     │    │    │
│ │ └─────────────────────────────────────────────────┘    │    │
│ │ (其他 tools: get_plan, execute_plan, list_plans)         │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

#### 10.2.7 Files

```
┌─ 📁 Files ──────────────────────────────────────────────────────┐
│ ┌─ 搜尋 ────┐ ┌─ Channel ─[全部 ▼]┐ ┌- Owner ─[全部 ▼]┐    │
│ └──────────┘ └─────────────────┘ └──────────────────┘    │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 📄 客戶會議記錄_2026Q3.pdf    2.3 MB                    │    │
│ │ Channel: ch_alpha  Owner: 王小明  上傳: 2 小時前         │    │
│ │ URL: https://la.aiconn.ai/f/eyJmaWxlSWQ...               │    │
│ │ [下載] [複製連結] [撤銷]                                  │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ [+ 上傳檔案]                                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 設計原則

| 原則 | 實作 |
|------|------|
| **狀態一眼看** | 統一 status pill：🟢🟡🔴⚪ |
| **資料可追蹤** | 每筆操作帶時間戳 + 操作者 |
| **危險操作需確認** | 刪除/撤銷/停用 → Modal 確認 |
| **可復原** | 刪除走 soft-delete（保留 30 天）|
| **可下鑽** | 列表點進去看詳情；不要一開始就全展開 |
| **測試優先** | 每個 skill 有「執行測試」按鈕 |

### 10.4 優先序

| 階段 | 工作 | 工作量 | 價值 |
|------|------|--------|------|
| **P1** | Dashboard metric 卡片 + 24h 圖表 | 1.5 天 | 高（看見系統狀態）|
| **P2** | Channels 列表 + CRUD | 2 天 | 高（多租戶管理入口）|
| **P3** | Skills 完整化：manifest drawer + 測試執行 | 1.5 天 | 高（管理現有資產）|
| **P4** | Agent Config（LLM + prompts + rate）| 2 天 | 中（擴展點）|
| **P5** | Sub-Agents 監控（taskforge plans）| 1.5 天 | 中（觀察運行）|
| **P6** | MCP Tools 頁 | 0.5 天 | 低（觀察用）|
| **P7** | Files 列表 + token 管理 | 1 天 | 中（檔案管理）|

**總計約 10 天**。可分兩輪交付：
- **第一輪**（P1+P2+P3）：基礎管理界面
- **第二輪**（P4+P5+P6+P7）：觀察與細節

### 10.5 已確認決策（user 2026-07-29 回覆）

| # | 問題 | 決策 | 影響 |
|---|------|------|------|
| 1 | Channels 登入機制 | **per-account login**：平台 admin 看不到，每個帳號只看自己的；聊天內容在自己 app 看（**認證功能已規劃未實作，需補**）| P2 要做 account 認證 |
| 2 | Dashboard 圖表 library | **recharts**（3 個 aibox-* 專案都用）| npm install recharts |
| 3 | Skill 測試執行介面 | **Admin 內嵌 sandbox**（推薦：form 填參數 + 顯示執行結果 + plan_id + task 進度）| P3 範圍 |
| 4 | 檔案分享 URL 管理 | **在 admin 設置**（P7 包含）| P7 範圍 |
| 5 | 即時更新 | **SSE** | 加 SSE endpoint |
| 6 | Dashboard 自動更新頻率 | **> 1min**（建議 60s）| 前端 polling interval |

**架構決策衍生**：
- SSE 需要 server 端 `text/event-stream` endpoint，前端用 EventSource
- per-account login 需要先補 `auth` 模組（JWT 或 session cookie）

### 10.6 已確認決策（user 2026-07-30 回覆 — Agent Center 合併）

| # | 問題 | 決策 | 影響 |
|---|------|------|------|
| 7 | Agent 與 Sub-Agent 是否合併成同一 entity | **不合併**（架構反對 — runtime 不同、lifecycle 不同，硬合併破壞 model）| 維持雙 entity |
| 8 | Admin UI 是否把 Agent + Sub-Agent 收成單一頁 | **是**，統一收成 **Agent Center**（一個 page + tabs 篩選）| 取代原 Agent.tsx + SubAgents.tsx |
| 9 | Agent Center 資料來源 | **雙 source，各自 API，admin 聚合顯示**：agents collection（ArangoDB）+ taskforge plans（Go）| 新增聚合 endpoint |
| 10 | 命名 | **主 Agent / Sub-Agent**（沿用本文件 section 3 命名標準）| 不引入新詞 |
| 11 | 副 Agent CRUD 模式 | **直接 proxy taskforge REST**（不建 ArangoDB 鏡像，保證即時）| server proxy 到 taskforge port 9900 |
| 12 | DAG editor 形式 | **先做列表式編輯**（每個 task 一行 + depends_on 下拉），視覺化節點拖曳**留到後續**（工作量大但非必要）| 第一輪不上 visual DAG |
| 13 | 第一輪交付範圍 | **M1 + M2 + M4 + M5 + M7**（聚合 endpoint + 主 Agent CRUD + list view + 主 Agent detail + 清理舊頁）| Sub-Agent 整合留第二輪 |
| 14 | Dashboard | **不與 Agent Center 同輪**，先專注 Agent Center | Dashboard 之後輪 |

**架構決策衍生**：
- 新增 `/admin/agent-center` 聚合 router（取代 `/admin/agents`）
- 新增 `/admin/agent-center/main` CRUD 子路由（包裝既有 `agentRepo`）
- 新增 `/admin/agent-center/sub` CRUD 子路由（proxy taskforge REST）
- Admin 新增 `AgentCenter.tsx` + `AgentDetail.tsx` + `SubAgentDetail.tsx` 三頁
- Sidebar 把原「Agent」「Sub-Agents」兩項合併為「Agent Center」一項
- SubAgentDetail 第一輪先做列表式 DAG（`tasks[]` 渲染為可編輯列表），不做 React Flow / vis.js 視覺化

詳細 mock wireframe：[`.docs/ADMIN_AGENT_CENTER_MOCK.md`](ADMIN_AGENT_CENTER_MOCK.md)

### 10.7 已確認決策（user 2026-07-30 回覆 — Agent Orchestration 統一設計）

> 完整設計見 [`.docs/AGENT_ORCHESTRATION_DESIGN.md`](AGENT_ORCHESTRATION_DESIGN.md)。
>
> **Hermes 提醒**：這個邏輯之前聊過了 — 在 `AGENT_ARCHITECTURE_AND_FLOW.md` section 2 有完整 state machine 設計（11 狀態、6 phase）。當時缺的產品決策現在補上（2026-07-30）。**不要再問「要不要做 orchestration」**，直接照 O1-O8 排程。

| # | 問題 | 決策 |
|---|------|------|
| 15 | 群聊觸發策略 | **A：只回 @mention**（1 對 1 私聊每次回應，群聊需 @botname 才回應）|
| 16 | Recursion 限制 | **B：max depth = 3**（user → 主 agent → sub-agent → skill）|
| 17 | `/` menu 來源 | **B：動態掃描 agents + skills**（不用硬編碼）|
| 18 | 預設入口 | **Polaris**（無 / 時自動用）|
| 19 | Phase 簡化 | **從 11 狀態縮成 8**（刪 AWAITING_CLARIFY、QUALITY_CHECK）|
| 20 | Sub-agent 執行 | **A：先 in-process**（LLM 扮演），未來升 B（taskforge proxy）|
| 21 | `/` 路由優先序 | **主 agent → sub-agent → skill**（同名字時不衝突）|

**實作優先序（O1-O8，總計 7 天）**：

| # | 工作 | 工作量 |
|---|------|--------|
| O1 | 統一 `/` menu（動態掃描 agents + skills）| 1 天 |
| O2 | `/{agent_name}` 路由 + 旁路 Polaris | 0.5 天 |
| O3 | Polaris intent routing（4 phase 縮版）| 1.5 天 |
| O4 | Agent delegation framework（max depth = 3 保護）| 1 天 |
| O5 | Sub-agent in-process 執行 | 1 天 |
| O6 | 群聊判斷（@mention 觸發）| 0.5 天 |
| O7 | Agent Center UI 顯示執行狀態 | 0.5 天 |
| O8 | 整合測試 | 1 天 |

**交付節奏**：
- **W1**：O1 + O2 + O3 + O6（用戶可 `/{name}` 呼叫、Polaris 自動 routing、群聊不洗版）
- **W2**：O4 + O5 + O7 + O8（agent 可互相呼叫、UI 顯示執行狀態、測試全綠）

---

## 11. 變更紀錄

| 日期 | 變更 |
|---|---|
| 2026-07-29 | 初版，明確分層模型與命名標準 |
| 2026-07-29 | 整合多租戶整體架構（LA / Channel / SeaweedFS / token URL）|
| 2026-07-29 | 新增「9. 擴展性設計」章節，預留多業務擴展點 |
| 2026-07-29 | 新增「10. Admin UI 詳細規劃」章節，含 7 頁 wireframe + 設計原則 + 優先序 |
| 2026-07-29 | 鎖定 6 個 admin UI 決策（recharts / SSE / per-account login / sandbox / 60s poll）|
| 2026-07-30 | 鎖定 8 個 Agent Center 相關決策（合併 page / 維持雙 entity / proxy taskforge / 列表式 DAG）|
| 2026-07-30 | 新增 `.docs/ADMIN_AGENT_CENTER_MOCK.md` 含 list/detail wireframe + 資料流 |