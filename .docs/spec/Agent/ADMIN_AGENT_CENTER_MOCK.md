# Admin Agent Center — Mock Wireframe

> 版本：v0.1 mock
> 日期：2026-07-30
> 狀態：**草案，待 user 確認後實作**
> 目的：討論 admin UI 的正確做法，不是 implementation

---

## 0. 問題回顧

前次討論達成三點共識：

1. ~~Role 概念~~ → **不採用**（每個 Agent 自帶 systemPrompt）
2. ~~Agent 和 Sub-agent 分兩個 page~~ → **改為單一 Agent Center page**
3. ~~Sub-agent 也是 Agent → 合併 entity~~ → **不採用**（runtime 不同，硬合併會破壞架構）

**最終決議（方案 B）**：

- ✅ Admin UX 統一（單一 page）
- ✅ Backend model 維持兩個 entity（不破壞架構）
- ✅ 單一聚合 list endpoint，前端依 type 路由到不同 detail

---

## 1. 頁面資訊架構

```
admin/src/pages/
├── AgentCenter.tsx          ← 新：統一入口（取代 Agent.tsx）
├── AgentDetail.tsx          ← 新：主 Agent 詳情（systemPrompt/model/...）
├── SubAgentDetail.tsx       ← 新：副 Agent 詳情（DAG 任務/goal template/...）
└── ...（Channels / Skills / McpTools / Dashboard 不變）
```

Sidebar 規劃：

```
📊 Dashboard
👥 Accounts                  ← 業務員帳號
📢 Channels                  ← LINE Channel
🤖 Agent Center              ← 新：統一管理（取代 Agent + Sub-Agents）
🛠  Skills                   ← Skill 管理
🔌 MCP Tools                 ← MCP 工具總覽
📁 Files
```

---

## 2. List View（Agent Center 主頁）

### 2.1 Wireframe

```
┌─ 🤖 Agent Center ──────────────────────────────────────────────────┐
│                                                                    │
│ ┌─ Tabs ────────────────────────────────────────────────┐          │
│ │ [全部 12]  [主 Agent 5]  [副 Agent 7]                │          │
│ └──────────────────────────────────────────────────────┘          │
│                                                                    │
│ ┌─ 搜尋 ─────────────┐  ┌─ 群組 ─[全部 ▼]┐  [+ 新增]   │          │
│ └────────────────────┘  └─────────────────┘               │          │
│                                                                    │
│ ┌─ 🤖 主 Agent ──────┐  ┌─ 📦 副 Agent ──────┐              │
│ │ 信義區房仲          │  │ 量子計算研究          │              │
│ │ ● 啟用              │  │ ● 啟用                │              │
│ │ systemPrompt:       │  │ Goal: 研究量子...      │              │
│ │   「你是一位專業...  │  │ Tasks: 4 (3 ✓ 1 ●)    │              │
│ │ model: Qwen3-8B     │  │ LLM: Qwen3-8B         │              │
│ │ skills: 5 啟用       │  │ plan_id: pf_a1b2c3    │              │
│ │ 連結 2 個 channel   │  │ 啟動: 2 分鐘前        │              │
│ │ [編輯] [▶ 對話] [⏸]│  │ [編輯 DAG] [▶ 監控]   │              │
│ └─────────────────────┘  └──────────────────────┘              │
│ ┌─ 🤖 主 Agent ──────┐  ┌─ 📦 副 Agent ──────┐              │
│ │ 零售客服            │  │ 文案生成              │              │
│ │ ...                 │  │ ...                   │              │
│ └─────────────────────┘  └──────────────────────┘              │
│                                                                    │
│ （更多卡片...）                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 互動

| 動作 | 結果 |
|------|------|
| 切 Tab | 篩選 list（全部/主/副） |
| 搜尋 | 依名稱/描述過濾 |
| 點卡片 | 開 detail drawer（右側 sheet）|
| 「▶ 對話」按鈕（主 Agent）| 跳轉到該 channel 的對話監控（未來做）|
| 「▶ 監控」按鈕（副 Agent）| 跳轉到 plan 即時監控 |
| 「+ 新增」 | 開 type-selector modal（先選 主/副）|

---

## 3. Detail View — 主 Agent（系統對話編排者）

### 3.1 Wireframe（Side Sheet）

```
┌─────────────────────────────┐
│ 🤖 信義區房仲     [啟用 ⏸] │ ← status pill，可即時停用
├─────────────────────────────┤
│ [基本] [Skills] [Rate] [Raw] │ ← tabs
│                              │
│ ┌─ System Prompt ─────────┐ │
│ │ 你是一位專業的不動產    │ │
│ │ 顧問，熟悉信義區豪宅... │ │
│ │                          │ │
│ │ [儲存] [重設]            │ │
│ └──────────────────────────┘ │
│                              │
│ ┌─ LLM 設定 ──────────────┐ │
│ │ Provider: (●) dllm  ( ) openai │
│ │ Model:    [Qwen3-8B  ▼] │
│ │ Temperature: [0.7] 滑桿 │
│ │ Max Tokens: [2048]      │
│ └──────────────────────────┘ │
│                              │
│ ┌─ 連結的 Channels ──────┐ │
│ │ 🟢 信義區豪宅 ch_alpha_123│ │
│ │ 🟡 內湖豪宅 ch_beta_456   │ │
│ │ [+ 連結]                  │ │
│ └──────────────────────────┘ │
│                              │
│ ── 統計 ────────────────── │
│ 24h 訊息: 142  |  Skill 呼叫: 89  |  平均延遲: 1.2s │
└──────────────────────────────┘
```

### 3.2 欄位對應到資料

| UI 區塊 | 後端欄位 | 來自 |
|---------|---------|------|
| System Prompt | `systemPrompt` | agents collection |
| LLM 設定 | `model`, `temperature`, `maxTokens` | agents collection |
| Skills tab | `enabledSkills[]` | agents collection（join skill registry）|
| Rate tab | `rateLimit`, `conversationTtl`, `historyLimit` | agents collection |
| 連結的 Channels | join via `channels.linkedAgentKey` | channels collection |
| 統計 | runtime counters | Redis or agents collection |
| Raw tab | 完整 manifest JSON | 開發者用 |

---

## 4. Detail View — 副 Agent（taskforge plan worker）

### 4.1 Wireframe（Side Sheet）

```
┌─────────────────────────────┐
│ 📦 量子計算研究  [啟用 ⏸]   │
├─────────────────────────────┤
│ [基本] [DAG] [執行紀錄] [Raw]│
│                              │
│ ┌─ Goal Template ──────────┐ │
│ │ 研究「${query}」的最新   │ │
│ │ 進展並整理成報告         │ │
│ │ [儲存]                   │ │
│ └──────────────────────────┘ │
│                              │
│ ┌─ Plan DAG ───────────────┐ │
│ │  ┌────────┐              │ │
│ │  │ T1: collect ✓         │ │
│ │  └────┬───┘              │ │
│ │       ▼                   │ │
│ │  ┌────────┐              │ │
│ │  │ T2: analyze ✓         │ │
│ │  └────┬───┘              │ │
│ │       ▼                   │ │
│ │  ┌────────┐              │ │
│ │  │ T3: outline ●         │ ← 執行中 │
│ │  └────┬───┘              │ │
│ │       ▼                   │ │
│ │  ┌────────┐              │ │
│ │  │ T4: write ○           │ ← 待執行 │
│ │  └────────┘              │ │
│ │ [+ 加任務]                │ │
│ └──────────────────────────┘ │
│                              │
│ ┌─ 對應 Skill ─────────────┐ │
│ │ 被 skill `web-search` 委派 │ │
│ │ （executor.type: taskforge）│ │
│ └──────────────────────────┘ │
│                              │
│ ── 統計 ────────────────── │
│ 啟動: 47 次  |  成功率: 91%  |  平均耗時: 38s │
└──────────────────────────────┘
```

### 4.2 欄位對應到資料

| UI 區塊 | 後端欄位 | 來自 |
|---------|---------|------|
| Goal Template | `goalTemplate` | taskforge（Go）或 ArangoDB 鏡像 |
| Plan DAG | `tasks[]` (id/type/depends_on) | taskforge |
| 對應 Skill | join by skill.manifest.executor.ref | skills/manifests/*.ts |
| 統計 | `stats.calls24h`, `successRate`, `avgDuration` | taskforge |
| Raw tab | taskforge plan JSON | taskforge |

---

## 5. 後端資料流（不變架構）

### 5.1 為什麼不合併 entity

```
┌──────────────────────────────────────────────────────────────┐
│ ❌ 不採用：合併到同一 collection                              │
│                                                              │
│ agents collection:                                           │
│   { _key, type: 'main'|'sub', ... }                          │
│                                                              │
│ 問題：                                                       │
│   - taskforge plan 存在 Go 進程記憶體，硬塞進 ArangoDB       │
│     會破壞它的 plan lifecycle（pending→running→completed）   │
│   - main agent 有 conversation state（Redis）               │
│   - sub agent 有 plan state（taskforge 記憶體）             │
│   - 不同 lifecycle 強行塞同 table 會出 race condition        │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 採用的做法

```
┌──────────────────────────────────────────────────────────────┐
│ ✅ 採用：雙 source，各自 API，admin 聚合顯示                  │
│                                                              │
│ ┌────────────────────┐    ┌────────────────────┐            │
│ │ agents collection  │    │ taskforge (Go)     │            │
│ │ (ArangoDB)         │    │                    │            │
│ │                    │    │                    │            │
│ │ 主 Agent           │    │ 副 Agent (plan)    │            │
│ │ • systemPrompt     │    │ • goal_template    │            │
│ │ • model/temp       │    │ • tasks[] DAG      │            │
│ │ • linkedChannels[] │    │ • lifecycle state  │            │
│ │ • conversationTTL  │    │ • stats            │            │
│ └────────────────────┘    └────────────────────┘            │
│         ↑                            ↑                       │
│         └──────────┬─────────────────┘                       │
│                    ↓                                         │
│       ┌────────────────────────┐                            │
│       │ GET /admin/agent-center │ ← 新聚合 endpoint        │
│       │ ?type=all|main|sub     │                            │
│       │ Returns unified shape:  │                            │
│       │ { id, type, name,       │                            │
│       │   status, ... }         │                            │
│       └────────────────────────┘                            │
│                    ↓                                         │
│       ┌────────────────────────┐                            │
│       │ Admin AgentCenter.tsx   │                            │
│       │ (不分來源，統一顯示)    │                            │
│       └────────────────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 新增的後端 endpoint

| Method | Path | 用途 |
|--------|------|------|
| GET | `/admin/agent-center?type=all\|main\|sub` | 統一 list（聚合兩個 source）|
| GET | `/admin/agent-center/:type/:id` | 單筆詳情（依 type 路由到對應 collection/taskforge）|
| POST | `/admin/agent-center/main` | 建立主 Agent |
| POST | `/admin/agent-center/sub` | 建立副 Agent（呼叫 taskforge）|
| PATCH | `/admin/agent-center/:type/:id` | 更新（依 type）|
| DELETE | `/admin/agent-center/:type/:id` | 刪除 |

---

## 6. 實作優先序（待討論）

| # | 工作 | 工作量 | 阻塞 |
|---|------|--------|------|
| **M1** | Server: `GET /admin/agent-center` 聚合 endpoint | 0.5 天 | 無 |
| **M2** | Server: 主 Agent CRUD（已有 agentRepo，可包進新 router） | 0.5 天 | — |
| **M3** | Server: 副 Agent CRUD（proxy taskforge REST） | 0.5 天 | taskforge port 9900 |
| **M4** | Admin: AgentCenter.tsx list view（tabs + card grid）| 1 天 | M1 |
| **M5** | Admin: AgentDetail.tsx（drawer for main agent）| 1 天 | M2 |
| **M6** | Admin: SubAgentDetail.tsx（drawer + DAG editor）| 1.5 天 | M3 |
| **M7** | 刪除舊頁面（Agent.tsx / SubAgents.tsx）+ 更新 Sidebar | 0.5 天 | M4 |
| **M8** | 整合測試（Playwright + API）| 0.5 天 | M4-M7 |

**總計約 6 天**。可分兩輪：
- **第一輪**（M1-M4 + M7）：基礎 list + 主 Agent CRUD
- **第二輪**（M3 + M5-M6）：副 Agent 整合 + DAG editor

---

## 7. 待 user 確認的問題

1. **架構 OK 嗎？**（單一 page + 雙 entity + 聚合 endpoint）
2. **副 Agent 的 CRUD 要直接 proxy taskforge 嗎？**還是想在 ArangoDB 建鏡像（犧牲即時性換取 admin 操作簡單）？
3. **DAG editor 要做視覺化（節點拖曳）還是列表式編輯？**視覺化工作量大但直覺
4. **「主 Agent」和「副 Agent」的中英文命名**：
   - 主 Agent / Sub-Agent / SubAgent / Worker / Plan
   - 或：Agent / Task / SubTask / Skill-Task
   - 或您有更好的命名？
5. **是否一起做 Dashboard？** 還是先專注 Agent Center？

---

## 8. 變更紀錄

| 日期 | 變更 |
|------|------|
| 2026-07-30 | 初版 mock，討論單一 page + 雙 entity 架構 |