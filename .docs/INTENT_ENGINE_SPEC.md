# 意圖引擎規格（Intent Engine Spec）

> 最後更新：2026-08-04
> 狀態：✅ 已實作並驗證（unit 13/13、pipeline e2e 4/4）
> 相關 commit：`c316c1b`（引擎）、`ec6c120`（DB 驅動取代寫死）、`b6b838f`（新結構重構）

---

## 1. 定位

意圖引擎是 LINE 訊息的「感知 → 行為」路由層。業務員可在 Admin Agent Center → Agent Detail → 意圖 tab
直接配置規則，**不需改程式碼**即可新增/調整訊息行為路由。規則存於 `agent_polaris.intents`（DB），
pipeline 讀取後 30 秒內生效（cache TTL）。

```
LINE message → PolarisPipeline.handleMessage
                 ├─ matchPolarisRoute（routing 規則）
                 ├─ matchIntentBehavior（意圖規則）← 本文檔
                 └─ agent.handleMessage（LLM fallback）
```

## 2. 規則結構

```
名稱 / 型別(message.type) / 細分型(subType) / 判斷(match) / 行為(behavior)
```

```typescript
interface IntentRule {
  id: string;
  name: string;                        // 名稱（問候、名片收集...）
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  subType?: string;                    // 細分型（text: 問候/打招呼/詢問/指令; image: 問候及祝福/名片/其他）
  match: {
    type: 'keyword' | 'regex';         // 判斷方式
    patterns: string[];                // 關鍵詞 或 regex pattern
  };
  behavior: {
    action: 'agent' | 'skill' | 'llm'; // 行為：Sub-Agent / Skills / LLM
    target: string;                    // agent 名 / skill id / llm 提示
    params?: Record<string, unknown>;
  };
  enabled: boolean;
  priority: number;                    // 越大越優先（同命中時）
}
```

### 2.1 細分型語意（關鍵設計決策）

| messageType | subType | 語意 | 匹配方式 |
|-------------|---------|------|---------|
| text | 問候 / 打招呼 / 詢問 / 指令 | **歸類標籤**（分類結果） | 靠 `match.patterns` 關鍵詞/regex 命中 |
| image | 問候及祝福 / 名片 / 其他 | **輸入條件**（OCR 分類結果） | subType 相等命中（patterns 可留空） |

**規則**：text 的 subType 不參與匹配（避免「你好」被 subType 擋掉）；
非 text（image/video...）的 subType 是硬條件，輸入必須相符。

### 2.2 匹配流程

1. 依 `priority` 高→低排序，過濾 disabled
2. `messageType` 必須等於輸入型別（預設 text）
3. 非 text 型別：`subType` 必須相等
4. patterns 為空 → 僅靠 messageType/subType 命中（如 image 名片）
5. patterns 非空 → keyword（includes）/ regex（test）逐一比對
6. 第一個命中即回傳，無命中回傳 null

### 2.3 行為（behavior.action）

| action | 執行 | target 語意 |
|--------|------|------------|
| `llm` | 主 agent 處理，systemContext 帶意圖提示 | LLM 提示文字（可留空） |
| `skill` | 走 slash 路由 `/${target} ${text}` | skill id（如 web-search、card-collection） |
| `agent` | 委派 sub-agent | agent 名（如 sirius、deneb） |

## 3. 檔案對應

| 檔案 | 職責 |
|------|------|
| `server/src/agent/intentEngine.ts` | IntentRule 型別、`getIntentRules()`（DB+30s cache）、`matchIntent()` |
| `server/src/agent/pipeline.ts` | `matchIntentBehavior()` — 依規則執行行為、帶入 messageType context |
| `server/src/data/agentRepo.ts` | Agent.intents 型別定義 + withDefaults |
| `server/src/routes/adminAgentCenter.ts` | PATCH 支援 intents 持久化 |
| `admin/src/pages/AgentDetail.tsx` | 意圖 tab 編輯表（型別/細分型/判斷/行為） |

## 4. 默認規則（seed，agent_polaris.intents）

| 優先序 | 名稱 | 型別/細分型 | 判斷 | 行為 |
|--------|------|------------|------|------|
| 90 | 問候及祝福（賀卡） | image/問候及祝福 | - | skill:ocr |
| 90 | 名片收集 | image/名片 | - | skill:card-collection |
| 85 | 研究/規劃（Sirius） | text | keyword | agent:sirius |
| 80 | 哲理/建議（Deneb） | text | keyword | agent:deneb |
| 70 | 網路搜尋 | text | keyword | skill:web-search |
| 70 | 寫作 | text | keyword | skill:write |
| 70 | 圖片其他 | image/其他 | - | skill:ocr |
| 60 | 指令 | text/指令 | keyword | llm |
| 50 | 問候 | text/問候 | keyword | llm |
| 45 | 打招呼 | text/打招呼 | keyword | llm |
| 40 | 詢問 | text/詢問 | keyword | llm |

## 5. 驗證

- ✅ 單元測試 13/13：text 4 細分型、Sirius/Deneb、搜尋/寫作、image 3 subType、sticker/text 無命中
- ✅ Pipeline e2e 4/4：「你好」→ llm、研究 → sirius、哲理 → deneb、搜尋 → web-search
- ✅ server + admin tsc 通過

## 6. 技術債與待辦

### 6.1 頂層 Webhook Event（已記錄於 README）

`webhook.ts` 僅 message/follow/unfollow 有處理，join/leave 刻意忽略，
其餘 9 種（postback/beacon/accountLink/things/unsend/memberJoined/memberLeft/videoPlayComplete/edit）
被 `if (event.type !== 'message') continue` 靜默丟棄。

區分原則：LINE 平台自動處理「顯示層」（群組成員系統訊息、收回/編輯顯示），
**postback 是唯一「LINE 完全不處理、純粹要我們回應」的頂層事件**。

| Event | 建議默認行為 | 現況 |
|-------|-------------|------|
| postback | 選單按鈕 → resolveMenuChoice → slash（選單系統已建好未接上）| ❌ |
| unsend | 撤回對應記憶/CRM 抽取 | ❌ |
| memberJoined/memberLeft | 群組歡迎詞/簿記（LINE 已自動顯示）| ❌ |
| edit | 重新處理編輯後訊息（LINE 已自動更新顯示）| ❌ |
| videoPlayComplete | 追蹤/後續行為 | ❌ |
| beacon/things/accountLink | 需 LINE 功能設定，可暫緩 | ❌ |

### 6.2 image 細分型接線

規則結構已支援 image subType，但 **OCR 結果尚未傳給 matchIntentBehavior 的 subType 參數**
（目前 `subType` 參數未從 OCR 流程帶入）。這是 image 規則生效的前置工作：
- `ocr.ts` 的 OCR 輸出 type（名片/問安卡/祝福賀卡/其他）→ 對映 subType（名片/問候及祝福/其他）
- webhook media 路徑 → pipeline 帶入 subType → matchIntent

### 6.3 welcome 文案參數化

`server/src/agent/selfIntro.ts` 的歡迎詞（follow 事件）目前為寫死字串，應改為讀取
`agent_polaris` 配置（符合「避免硬編碼」原則）。

## 7. 修改歷程

| 日期 | 版本 | 變更 |
|------|------|------|
| 2026-08-04 | 1.0.0 | 初版：意圖引擎規格（結構/匹配/行為/seed/驗證/技術債）|
