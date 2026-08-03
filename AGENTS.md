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
