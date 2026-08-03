# AGENTS.md — LINE 代理（LINE Agent Platform）

> 最後更新：2026-08-02

## 產品定位

多租戶 LINE OMO 助手平台。業務員申請自己的 LINE Channel → 產生分身助手 → 客戶加好友即可使用 AI 對話、CRM、群發等功能。所有分身共用統一後台 Agent，透過 **Person Token** 隔離資料。

## 設計與架構文件

所有架構、設計、規格文件統一放在 `.docs/`（不是 `docs/`）：

| 文件 | 內容 |
|------|------|
| [`.docs/AGENT_LAYER_ARCHITECTURE.md`](.docs/AGENT_LAYER_ARCHITECTURE.md) | **完整架構說明**（LA / Channel / Agent / Skill / Sub-agent / SeaweedFS / token URL / Admin 規劃）|
| [`.docs/init.md`](.docs/init.md) | SAM 原 spec（系統定位、MoE 路由、USB 保險箱）|
| [`.docs/spec/index.md`](.docs/spec/index.md) | 21 個 UI 頁面規格索引 |

**慣例**：新架構文件放 `.docs/`，不要開新的 `docs/` 目錄。`.docs/` 是設計/規格的單一真相。

## 傳遞方式

- **Web App**（PWA），不需 APK / iOS App
- 一般使用者前端：`https://la.aiconn.ai` → proxy:7010 → Express:9091
- 平台管理後台：`https://admla.aiconn.ai` → Vite:7012
- 官方網站（規劃中）：`web/` 目錄預留

## Monorepo 結構（pnpm workspace）

```
sam/
├── client/          Expo (React Native Web) — 一般使用者前端（目錄名是 client/，不是 app/）
│   ├── app/         Expo Router routing（Tabs + Stack）
│   ├── screens/     頁面實作（每個 Tab 一個目錄）
│   ├── components/  共用元件（Screen, AccountAvatar, USBStatusBadge...）
│   ├── hooks/       自訂 hooks
│   ├── contexts/    React Context（AuthContext, ThemeContext）
│   ├── theme/       色彩系統
│   ├── web/         PWA 靜態資源（manifest, sw.js, index.html）
│   ├── scripts/     建置腳本（proxy.mjs, post-build.mjs）
│   └── assets/      圖片等靜態檔案
├── admin/           Vite + React + TypeScript — 平台管理後台（port 7012）
│   ├── src/
│   │   ├── api/         API client (JWT auth, token 存 admin_token)
│   │   ├── components/  Layout, Sidebar, Header, Footer, FlowEditor
│   │   ├── pages/       Login, Dashboard, Accounts, Channels, Cards, AgentCenter,
│   │   │                AgentDetail, Skills, BusinessDocs, Files, McpTools
│   │   └── styles/      theme.css (aistock 風格 layout)
│   ├── e2e/          Playwright 端對端測試（admin-verify.spec.cjs）
│   └── vite.config.ts   (port 7012)
├── server/          Express.js 後端（API + LINE Webhook, port 9091）
│   ├── src/agent/    Agent layer（pipeline, intent, skills, memory, rate limiter）
│   ├── src/data/     ArangoDB repos（agent/channel/account/memory/files/businessDoc...）
│   ├── src/lib/      qdrant, seaweedFs, shareToken, taskforge, metrics, embedder
│   └── src/routes/   Express routes（admin* 系列 = 管理後台 API）
├── service/         Rust (Axum) API Gateway — 統一入口路由到各 Python 服務（port 9092）
├── web/             官方網站（預留，尚未實作）
├── .docs/           架構/設計/規格文件（單一真相）
│   └── spec/        21 頁 UI 規格
└── eslint-plugins/  自訂 ESLint 規則
```

## 服務埠號

| 埠 | 服務 | 網域 |
|----|------|------|
| 7010 | Proxy (serve dist/ + proxy API/Webhook) | `la.aiconn.ai` |
| 7011 | Expo dev server | - |
| 7012 | Admin Panel (Vite) | `admla.aiconn.ai` |
| 8529 | ArangoDB（共用 instance, DB=`sam`） | 內部 |
| 9091 | Express backend (API + Webhook) | 內部 |
| 9092 | Rust API Gateway (sam-service) | 內部 |

## 基礎服務（host-level infra）

> **架構原則**：基礎服務（ArangoDB、Qdrant、Redis、SeaweedFS）由 host-level `docker-compose.infra.yml` 啟動，**所有業務共享同一個 instance**。業務 repo 不應自帶 infra 設定。
>
> 完整說明與 ArangoDB 多業務 DB 創建規範：[`DanielChung520/workspace-infra`](https://github.com/DanielChung520/workspace-infra)（host-level infra notes）

### ArangoDB（本專案使用）

| 項目 | 值 |
|------|-----|
| Instance | host-level `arangodb` container（不歸 sam repo 管） |
| URL | `http://localhost:8529`（無 auth） |
| DB | `sam`（在共用 instance 內，多業務 `_db/<name>` 隔離） |
| 設定 | `ARANGO_URL=http://localhost:8529`、`ARANGO_DB=sam`（在 repo root `.env`） |

**健康檢查：**

```bash
curl http://localhost:8529/_api/version
curl http://localhost:8529/_api/database  # 列出所有 DB，應該看得到 "sam"
```

**路由連線（`sam` DB 內的 collection 與文件）：**

```bash
curl http://localhost:8529/_db/sam/_api/collection
```

如需建立新業務 DB（例如新增 `his` / `kag`），參見 `~/github/README.md` 的「ArangoDB — 多業務共用與 DB 創建」段落。

## 開發指令

| 指令 | 說明 |
|------|------|
| `pnpm -w lint:all` | TypeScript + ESLint 檢查（含 admin） |
| `cd client && npm run start` | Expo dev server（port 7011） |
| `cd admin && npm run dev` | Admin panel dev server（port 7012） |
| `cd server && npx tsx src/index.ts` | Express API server（port 9091） |
| `cd service && cargo run` | Rust API Gateway（port 9092） |
| `cd client && npx expo export -p web && node scripts/post-build.mjs` | Production build（產出 `client/dist/`） |
| `cd client && node scripts/proxy.mjs` | PWA server（port 7010，serve dist/ + proxy API/Webhook → 9091） |

## 啟動方式

> 基礎服務（ArangoDB:8529、Redis:6379、SeaweedFS、Qdrant）由 host-level infra 負責，確認已在跑即可。Agent layer 額外依賴 `dllm serve`（LLM）與 taskforge:9900。

### 輕啟動（日常開發，tmux 三支）

```bash
tmux new-session -d -s sam-server -c server "npx tsx src/index.ts"   # Express :9091
tmux new-session -d -s sam-proxy  -c client "node scripts/proxy.mjs" # PWA :7010（需先 build）
tmux new-session -d -s sam-admin  -c admin  "npm run dev"            # Admin :7012
```

注意：`-c` 是 session 啟動目錄，指令內**不要**再包一層 `cd`。proxy 需要 `client/dist/` 存在（先跑過 production build）。

### 啟動驗證

```bash
curl http://localhost:8529/_api/version          # ArangoDB
curl http://localhost:9091/api/v1/health         # Express → {"status":"ok"}
curl -o /dev/null -w "%{http_code}" http://localhost:7010/   # PWA proxy → 200
curl -o /dev/null -w "%{http_code}" http://localhost:7012/   # Admin → 200
```

### Admin e2e 測試

```bash
npx playwright test          # 10 tests（admin/e2e/admin-verify.spec.cjs），需 :7012 + :9091 在跑
```

## 目前階段

- ✅ 5 個 Tab 頁面 + 16 個 Detail 頁面 UI 完成
- ✅ PWA production build + service worker
- ✅ Express 後端 JWT auth + LINE Webhook
- ✅ **Agent Layer 全 7 phases**（server/src/agent/：intent classifier、skill registry、state store、memory、rate limiter、webhook 已接 pipeline）
- ✅ **Admin Panel 擴建**（Agent Center、Agent Detail、Business Docs、Files、MCP Tools、Skills 流程編輯器 + 14 條 admin API）
- ✅ **Admin e2e 測試** 10/10 通過（Playwright）
- ✅ Rust API Gateway 基礎架構
- ⬜ 登入頁面整合（Expo App AuthContext）
- ⬜ 多租戶管理後台串接真實 LINE Channel 資料
- ⬜ 官方網站 `web/`

## 管理後台

| 項目 | 說明 |
|------|------|
| 網址 | `https://admla.aiconn.ai` |
| 預設帳號 | 見 `admin/.env`（目前為 dev auto-login：username 當 channelId，密碼未驗證） |
| 設定檔 | `admin/.env` |

## 設計系統

- **Uniwind**（TailwindCSS for React Native）
- 新形態設計（軟卡片、雙陰影、無邊框）
- 主色：翡翠綠 #059669，強調色：琥珀橙 #F97316
- Admin Panel 採用 aistock 風格（窄 sidebar + header + footer）
- 完整調色盤：`DESIGN.md`

## 開發原則

### 0. 產品思維（Product Mindset）

這是**產品專案開發**，不是臨時方案。所有程式碼與設計必須符合產品標準：

- **標準化** — 遵循專案既有慣例與風格，不為求快走捷徑
- **正規化** — 架構設計要完整，不偷工減料
- **參數化** — 配置一律放環境變數或 DB，嚴禁 hardcode
- **產品觀** — 開發環境的程式碼品質 = 上線標準，沒有「先求有再求好」

### 1. Product Development Principles

- **避免硬編碼**：配置性內容（URL、端口、secret）一律放 `.env`，嚴禁散落寫死在程式碼
- **適當解耦**：模組間低耦合，透過 interface/route 通訊
- **標準化**：遵循現有程式碼風格與專案慣例
- **可維護性**：程式碼應具有可讀性與可擴展性

### 2. 多租戶隔離原則（憲法級規範）

所有資料操作必須帶 `channelId`（或 `businessOwnerId`）隔離：

- 每個 channel 的資料（contacts/messages/files）獨立存放
- 前端請求一律帶 `x-channel-id` header（`client/utils/api.ts` 統一處理）
- 新增任何資料查詢，必須先確認 channel 過濾

### 3. 產出物格式原則（憲法級規範）

Agent 的「產出物」（文件/文章/報告/清單）統一走 HTML 文件流程：

```
Agent 回傳 { title, content(markdown) } JSON
  → pipeline 轉 HTML（markdownToHtml）
  → 存 SeaweedFS（artifactStore）
  → LINE 回「📄 標題 + 短連結」
```

- 一般對話回純文字，不包 JSON（見 `agentDelegation.ts` 的 `OUTPUT_FORMAT_RULE`）
- 嚴禁 agent 產出直接輸出長文給 LINE（應存檔回連結）

### 4. Code & File Header Standards

所有程式碼檔案必須包含表頭註解：

```typescript
// 檔案說明概要
// 詳細說明（可選）
```

> 現有慣例為 `//` 單行註解開頭，新檔案沿用此風格。

### 5. Module Size Guidelines

| 語言 | 單檔上限 | 建議上限 |
|------|---------|---------|
| TypeScript | 400 行 | 250 行 |
| React/TSX | 400 行 | 250 行 |

超過上限的檔案應拆分成多個模組。

### 6. Temporary Files Management

- 所有臨時測試檔統一放 `/tmp/` 或測試後立即刪除
- 禁止在專案根目錄或 `server/` 留下 `*.tmp.*` 測試檔
- 測試檔命名 `test-*.tmp.mts`，用完即刪

### 7. Duplicate Prevention Check

新增任何程式碼或檔案前，必須：
1. 查看 `README.md` 與 `AGENTS.md` 確認現有結構
2. 搜尋現有功能（`codegraph_explore` 或 grep）
3. 確認複用可能性（共用 helper：`authJwt.ts`、`lineClient.ts`、`fileStorage.ts`）

### 8. 服務操作規範

| 服務 | 端口 | tmux session | 重啟方式 |
|------|------|-------------|---------|
| Express API | 9091 | `sam-server` | `tmux kill-session -t sam-server && tmux new-session -d -s sam-server "cd /home/daniel/github/sam/server && npx tsx src/index.ts"` |
| PWA proxy | 7010 | `sam-proxy` | `cd client && node scripts/proxy.mjs`（需先 build）|
| Admin Panel | 7012 | `sam-admin` | `cd admin && npm run dev` |
| taskforge | 9900 | `taskforge` | `cd ~/github/taskforge && ./taskforge start`（非 git repo，source 改動須手動 rebuild）|
| dllm | 11400 | systemd | `dllm serve`（VL 模型 lazy-load）|

> ⚠️ 停止/重啟 tmux 服務前，先確認影響範圍。taskforge rebuild 後必須重啟才生效。

### 9. 安全規範（強制）

所有破壞性操作參照 `.sisyphus/safety-rules.md`：

- **先輸出指令，經確認後由使用者手動執行**，AI 不得自行執行
- ArangoDB 更新一律用 `PATCH` / `UPDATE ... WITH`，禁用 `PUT`
- 基礎設施（ArangoDB/Qdrant/Redis/SeaweedFS/tmux/sudo）操作須確認

### 10. 流程節點屬性規範（憲法級）

Skills 流程編輯器（`admin/src/components/FlowEditor.tsx`）的節點，**必須依節點屬性在右側屬性欄顯示對應屬性**（參考 n8n / Dify 的節點屬性面板）。

#### 10.1 設計原則

- **不做流程維護**：流程不是人為在編輯器手工維護的產物，而是**由 AI 與使用者以自然語言討論生成**，或**外部導入 XML / JSON**。
- **屬性 Schema 驅動**：每個節點 type 定義一組屬性 schema，右側屬性欄依 schema 渲染對應的表單（輸入框 / 下拉 / 代碼編輯器 / 開關）。
- **節點 config 即屬性**：`FlowNode.config` 的欄位就是節點的屬性值，schema 描述每個欄位的型別與編輯方式。

#### 10.2 節點屬性 Schema

每個節點 type（`trigger` / `llm` / `condition` / `function` / `skill` / `storage` / `reply` / `memory` / `tool`）應定義：

```typescript
// 節點屬性 schema（示意）
interface NodePropSchema {
  name: string          // config 欄位名
  label: string         // 屬性欄顯示名稱
  type: 'string' | 'number' | 'boolean' | 'select' | 'code' | 'json' | 'textarea'
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]   // select 用
  default?: unknown
  desc?: string         // 屬性說明（含資料格式說明）
}
```

#### 10.3 右側屬性欄顯示規則

- 節點點擊後，右側欄顯示該節點 type 對應的屬性表單（取代目前僅 Title/Description/Config 摘要的做法）。
- 屬性欄依 schema 渲染：`string`→文字輸入、`number`→數字輸入、`boolean`→開關、`select`→下拉、`code`→程式碼編輯器、`json`→JSON 編輯器、`textarea`→多行文字。
- **屬性說明（desc）必須描述資料格式**：如輸入欄位說明該節點吃什麼 JSON（例：`接收圖片` 節點說明 image / channelId / receivedAt），輸出節點說明吐什麼 JSON。
- 未定義 schema 的節點維持基本編輯（Title/Description/Enabled）。

#### 10.4 生成與導入

- **AI 討論生成**：流程由使用者與 AI **以自然語言討論需求**（例如「幫我做一個收到圖片後辨識名片的流程」），AI 理解後依節點 type 的 schema 產出流程定義（寫入 name-card.json 或 skill_flows collection）。不經人工在編輯器逐節點維護。
- **外部導入**：支援從 XML（n8n 風格）或 JSON 匯入流程定義，轉換為 `FlowNode[]`。
- 流程儲存：`admin/skills/name-card.json`（定義檔）+ server `skill_flows` collection（執行時資料）。

#### 10.5 輸入/輸出規格

- 技能層級定義 `inputSchema` / `outputSchema`（見 `admin/src/data/skill-catalog.ts`），顯示於 FlowEditor 右側欄頂部的「📥 輸入規格 / 📤 輸出規格」面板。
- 節點層級的屬性 desc 也應描述該節點處理的資料格式（輸入吃什麼 / 輸出吐什麼）。

## 文件索引

| 文件 | 內容 |
|------|------|
| `AGENTS.md` | 專案總覽、開發原則、操作規範（本文件）|
| `.sisyphus/safety-rules.md` | **安全規範** — 破壞性操作 SOP、PATCH 原則 |
| `DESIGN.md` | UI/UX 設計系統（色彩、Typography、元件）|
| `.docs/AGENT_LAYER_ARCHITECTURE.md` | 完整架構說明 |
| `.docs/init.md` | SAM 原 spec |
| `.docs/spec/index.md` | UI 頁面規格索引 |
| `README.md` | 安裝與啟動說明 |

## 修改歷程

| 日期 | 版本 | 更新者 | 變更內容 |
|------|------|--------|----------|
| 2026-08-03 | 1.2.0 | Sisyphus | 新增 10. 流程節點屬性規範（憲法級）：節點屬性欄、schema 驅動、AI 生成/外部導入 XML/JSON |
| 2026-08-03 | 1.1.0 | Sisyphus | 新增開發原則（產品思維/多租戶/產出物格式/header/module size/臨時檔/複用檢查/服務操作/安全規範）+ 文件索引 + 修改歷程 |
| 2026-08-02 | 1.0.0 | Daniel Chung | 初始版本 |

