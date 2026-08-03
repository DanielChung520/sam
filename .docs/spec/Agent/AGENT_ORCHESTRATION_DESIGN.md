# Agent Orchestration — 統一設計（用戶確認版）

> 版本：v1.0 — **user 確認 2026-07-30**
> 維護者：Sisyphus / Hermes（Polaris）
> 狀態：**已記錄，準備逐步實作**
> 補丁：補上之前 AGENT_ARCHITECTURE_AND_FLOW.md 缺漏的產品決策

---

## 0. Hermes 提醒（給未來的自己 / 交接者）

> **這個邏輯之前聊過了** — 在 `AGENT_ARCHITECTURE_AND_FLOW.md` section 2 有完整 state machine 設計（11 狀態、6 phase）。
>
> **當時缺的東西**：產品決策 — 「什麼時候觸發 Sirius」「sub-agent 怎麼執行」「群聊怎麼處理」。
>
> **這份文件補上決策**，整合下面三個檔的內容：
> - `AGENT_ARCHITECTURE_AND_FLOW.md`（state machine + 流程）
> - `ADMIN_AGENT_CENTER_MOCK.md`（UI 設計）
> - `MEMORY_AND_CONTEXT_DESIGN.md`（記憶 / context 注入）
>
> 不要再問「要不要做 orchestration」，直接照 O1-O8 排程。

---

## 1. 產品定位（user 確認）

LINE 分身助理 — 跟朋友私聊、群聊。

需要一個 **能協調聊天、執行工作、監督工作** 的 Orchestration agent。

核心行為：
1. 平常整理 intent routing → 自動 call skills / MCP
2. 用 `/{name}` 明確指定 agent（跳過 routing）
3. 用 `/` 列出所有可呼叫物件（編號選）
4. Agent 內可呼叫其他 agent / skill / MCP（recursion）

---

## 2. 三條觸發路徑（user 確認 2026-07-30）

```
客戶訊息 X
    ↓
┌──────────────────────────────────────────────────────────────┐
│ 1. /{name} 開頭     → 明確指定 agent（旁路 Polaris）          │
│ 2. / 開頭無名字    → 顯示 menu 等用戶選（1, 2, 3...）       │
│ 3. 無 /            → 走 Polaris（intent routing → 自動）      │
└──────────────────────────────────────────────────────────────┘
    ↓
    執行（agent 內可遞迴呼叫 skill / sub-agent / 其他 agent）
    ↓
    結果 → 客戶
```

### 預設行為（無 /）

- Polaris 是預設入口 — 透明編排
- 不指定 = 用戶信任 Polaris 自動判斷

---

## 3. 統一 `/` Menu（user 確認動態掃描）

按 **用戶決定 B（動態掃描）**：menu 從 `agents` collection + skill registry + MCP config 自動組合。

### Menu 結構（顯示順序）

```
📋 可用功能：

🤖 主 Agents（會自己做決策）
  1. /polaris    對話編排（預設入口）
  2. /sirius     任務規劃（DAG 拆解）
  3. /vega       品質審查
  4. /altair     記憶管理
  5. /deneb      深度諮詢

⚙️ Sub-Agents（Worker — 執行單一任務）
  6. /rigel      資料蒐集
  7. /capella    質疑驗證
  8. /betelgeuse 深度分析
  9. /aldebaran  大綱設計
  10. /spica     內容撰寫
  11. /antares   品質審查
  12. /arcturus  最終組裝

🛠 Skills（即時工具）
  13. /search <query>      搜尋
  14. /analysis <topic>    深度分析
  15. /write <topic>       長文寫作

回覆數字選擇，或直接輸入 /指令 內容。
```

### Menu 來源

| 類型 | 來源 | 取得方式 |
|------|------|---------|
| 主 Agents | `agents` collection（`category: orchestrator\|planner\|reviewer\|memory\|consultant`）| `GET /admin/agent-center?type=main` |
| Sub-Agents | `agents` collection（`category: worker`）| `GET /admin/agent-center?type=sub` |
| Skills | `skillRegistry.getAll()` | in-process |
| MCP Tools | taskforge MCP config | future |

---

## 4. 統一 `/` Routing 邏輯（user 確認）

```
用戶輸入 /xxx
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 1. 完全等於 "/" → 顯示完整 menu                                  │
│ 2. /{name} 匹配主 agent → 旁路 Polaris，呼叫該 agent              │
│ 3. /{name} 匹配 sub-agent → 旁路 Polaris，呼叫該 agent            │
│ 4. /{name} 匹配 skill → 帶參數執行 skill                          │
│ 5. /{menu_choice:number} → 解析為對應的 agent/skill 執行         │
│ 6. /{未知} → 「找不到指令 X，可用 / 看完整列表」               │
└─────────────────────────────────────────────────────────────────┘
```

### `/{agent_name}` 解析規則

- **不區分大小寫** — `/Polaris` = `/polaris`
- **支援部分匹配** — `/pol` = `/polaris`（唯一匹配時）
- **衝突時要求明確** — `/sp` 同時匹配 Spica + Sub-Agents 列表時顯示「請選 1 或 2」
- **參數傳遞** — `/sirius 研究量子計算` → agent=sirius, input=「研究量子計算」

---

## 5. Agent Delegation Framework（user 確認 max depth = 3）

```
Agent X 執行時
    ↓
可呼叫：
  - skill（sync / async）
  - sub-agent（LLM 扮演）
  - 其他 agent（recursion）
    ↓
限制：
  - max delegation depth = 3（user 決定 B）
  - 同一 call chain 內不可重複 agent（防無限迴圈）
  - 每次 delegation 記錄 call graph（debug + 監控）
```

### Max Depth 規則

| 層 | 誰可以呼叫誰 |
|----|-------------|
| **L1**（root）| 用戶訊息 → Polaris/Sirius/Vega/Altair/Deneb |
| **L2** | 主 agent 可呼叫 sub-agent（Rigel/Capella/...）|
| **L3** | sub-agent 可呼叫 skill |
| **L4+** | ❌ 不允許（max depth = 3）|

### Call Graph 範例

```
User: "研究量子計算並寫成報告"
    ↓ L1
Sirius: 拆 DAG
    ↓ L2 (depth=2)
Rigel: 蒐集資料
    ↓ L3 (depth=3)
Skill: web-search
    ↓ done

Betelgeuse: 分析 (depth=2)
    ↓ done

Spica: 撰寫 (depth=2)
    ↓ done

Antares: 審查 (depth=2)
    ↓ done

Arcturus: 組裝 (depth=2)
    ↓ done

Sirius 收集所有 → 輸出
```

### 防迴圈檢查

```typescript
function canCall(caller: Agent, target: Agent, depth: number, history: Agent[]): boolean {
  if (depth >= 3) return false;
  if (history.includes(target)) return false;
  return true;
}
```

---

## 6. Polaris Intent Routing（user 確認 B = clarity-driven）

```
Polaris 收到訊息（無 /{name}）
    ↓
┌──────────────────────────────────────────────────────────────┐
│ 1. 載入 context（memory + KB retrieval）                      │
│ 2. 跑 intent classifier                                       │
│    - regex 快路 → 命中直接執行                                │
│    - LLM 慢路 → JSON {intent, confidence, suggested_skill}    │
│ 3. 決策分支：                                                  │
│    a. confidence >= 0.8 + suggested_skill 在白名單              │
│       → 呼叫 skill                                             │
│    b. confidence >= 0.5 + intent = complex_task                │
│       → 委派 Sirius 拆 DAG                                     │
│    c. confidence < 0.5                                          │
│       → 反問釐清（最多 max_clarification_rounds）               │
│    d. intent = out_of_scope                                    │
│       → 委派 Deneb 深度回答                                    │
│    e. intent = greeting/menu/help                              │
│       → 對應 skill                                             │
│ 4. 執行                                                      │
│ 5. （可選）Vega 審查                                          │
│ 6. 回應客戶                                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. 群聊邏輯（user 確認 A = 只回 @mention）

| 場景 | 行為 | 觸發條件 |
|------|------|---------|
| **1 對 1 私聊** | ✅ 每次都回應 | event.source.type === 'user' |
| **群聊 @mention** | ✅ 回應 | message.text 包含 @分身 或 @botname |
| **群聊關鍵字** | ❌ 不介入（可設定，未來做）| future |
| **群聊一般對話** | ❌ 不介入 | 預設 |

### LINE Webhook 判斷

```typescript
function shouldRespond(event: WebhookEvent, botName: string): boolean {
  if (event.source.type === 'user') return true; // 私聊
  if (event.source.type === 'group') {
    const text = event.message.text ?? '';
    return text.includes(`@${botName}`) || text.includes('@分身');
  }
  return false;
}
```

---

## 8. Phase 簡化（從 11 狀態縮成 8）

原本 AGENT_ARCHITECTURE_AND_FLOW.md 有 11 狀態 — 對 LINE 分身太複雜。

**精簡版（用戶確認）**：

| State | 用途 |
|-------|------|
| `IDLE` | 等待訊息 |
| `RECEIVED` | 已收到訊息，待 routing |
| `UNDERSTANDING` | intent classification |
| `PLANNING` | Sirius 拆 DAG（complex_task）|
| `EXECUTING` | skill / sub-agent / agent 執行中 |
| `RESPONDING` | 組裝回應 + 送出 |
| `DONE` | 完成 |
| `ESCALATED` | 失敗，需人工 |

刪除的狀態：`AWAITING_CLARIFY`（合進 UNDERSTANDING）、`QUALITY_CHECK`（合進 EXECUTING）

---

## 9. 實作優先序（精簡 — 直接對應用戶需求）

| # | 工作 | 工作量 |
|---|------|--------|
| **O1** | 統一 `/` menu（動態掃描 agents + skills）| 1 天 |
| **O2** | `/{agent_name}` 路由 + 旁路 Polaris | 0.5 天 |
| **O3** | Polaris 真正的 intent routing（4 phase 縮版）| 1.5 天 |
| **O4** | Agent delegation framework（含 max depth = 3 保護）| 1 天 |
| **O5** | Sub-agent in-process 執行（LLM 扮演）| 1 天 |
| **O6** | 群聊判斷（@mention 觸發）| 0.5 天 |
| **O7** | Agent Center UI 加「執行狀態 / 上次被呼叫」| 0.5 天 |
| **O8** | 整合測試（`/menu` 顯示 + agent delegation + 群聊）| 1 天 |

**總計約 7 天**。

### 交付節奏

| 週 | 工作 | 驗收 |
|----|------|------|
| **W1** | O1 + O2 + O3 + O6 | user 可 `/{name}` 呼叫、Polaris 自動 routing、群聊不洗版 |
| **W2** | O4 + O5 + O7 + O8 | agent 可互相呼叫、UI 顯示執行狀態、測試全綠 |

---

## 10. 已確認決策（user 2026-07-30）

| # | 問題 | 決策 |
|---|------|------|
| 1 | 群聊觸發策略 | **A：只回 @mention** |
| 2 | Recursion 限制 | **B：max depth = 3** |
| 3 | `/` menu 來源 | **B：動態掃描 agents + skills** |
| 4 | 預設入口 | **Polaris（無 / 時自動用）** |
| 5 | Phase 簡化 | **從 11 狀態縮成 8** |
| 6 | Sub-agent 執行 | **A：in-process（先），未來升 B（taskforge）** |
| 7 | `/` 開頭解析 | **優先匹配主 agent，其次 sub-agent，最後 skill** |

---

## 11. 與其他文件的一致性

| 文件 | 一致性 |
|------|-------|
| `AGENT_LAYER_ARCHITECTURE.md` section 10.6 | 沿用前 8 個決策（已記錄）|
| `AGENT_ARCHITECTURE_AND_FLOW.md` | 本文件是它的精簡實作版（11→8 狀態、加上 `/{name}` 路由）|
| `ADMIN_AGENT_CENTER_MOCK.md` | UI 顯示需加上「執行狀態 / 上次被呼叫」（O7）|
| `MEMORY_AND_CONTEXT_DESIGN.md` | Polaris 注入 retrieval context 不變 |

---

## 12. 變更紀錄

| 日期 | 變更 |
|------|------|
| 2026-07-30 v1.0 | 初版，user 確認 7 項決策，準備逐步實作 |