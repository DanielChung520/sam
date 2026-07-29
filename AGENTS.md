# AGENTS.md — LINE 代理（LINE Agent Platform）

> 最後更新：2026-07-29

## 產品定位

多租戶 LINE OMO 助手平台。業務員申請自己的 LINE Channel → 產生分身助手 → 客戶加好友即可使用 AI 對話、CRM、群發等功能。所有分身共用統一後台 Agent，透過 **Person Token** 隔離資料。

完整產品架構：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 傳遞方式

- **Web App**（PWA），不需 APK / iOS App
- 一般使用者前端：`https://la.aiconn.ai` → proxy:7010 → Express:9091
- 平台管理後台：`https://admla.aiconn.ai` → Vite:7012
- 官方網站（規劃中）：`web/` 目錄預留

## Monorepo 結構（pnpm workspace）

```
sam/
├── app/             (原 client/) Expo (React Native Web) — 一般使用者前端
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
│   │   ├── api/         API client (JWT auth)
│   │   ├── components/  Layout, Sidebar, Header, Footer, Modal
│   │   ├── pages/       Login, Dashboard, Admins, Accounts, Channels, Cards, Agent
│   │   └── styles/      theme.css (aistock 風格 layout)
│   └── vite.config.ts   (port 7012)
├── server/          Express.js 後端（API + LINE Webhook, port 9091）
├── service/         Rust (Axum) API Gateway — 統一入口路由到各 Python 服務（port 9092）
├── web/             官方網站（預留，尚未實作）
├── docs/            產品架構文件
├── .docs/           工作筆記、規格文件
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
> 完整說明與 ArangoDB 多業務 DB 創建規範：[`~/github/README.md`](https://github.com/DanielChung520/sam/edit/main/)（host-level infra notes）

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
| `cd app && npm run start` | Expo dev server（port 7011） |
| `cd admin && npm run dev` | Admin panel dev server（port 7012） |
| `cd server && npx tsx src/index.ts` | Express API server（port 9091） |
| `cd service && cargo run` | Rust API Gateway（port 9092） |
| `cd app && npx expo export -p web && node scripts/post-build.mjs` | Production build |
| `cd app && node scripts/proxy.mjs` | PWA server（port 7010） |

## 目前階段

- ✅ 5 個 Tab 頁面 + 16 個 Detail 頁面 UI 完成
- ✅ PWA production build + service worker
- ✅ Express 後端 JWT auth + LINE Webhook
- ✅ 平台管理後台（Admin Panel）— 6 個管理頁面
- ✅ Rust API Gateway 基礎架構
- ⬜ 登入頁面整合（Expo App AuthContext）
- ⬜ AI Agent 整合 + Webhook 業務邏輯
- ⬜ 多租戶管理後台（串接真實 API）

## 管理後台

| 項目 | 說明 |
|------|------|
| 網址 | `https://admla.aiconn.ai` |
| 預設帳號 | 見 `admin/.env` |
| 設定檔 | `admin/.env` |
- ⬜ 官方網站 `web/`

## 設計系統

- **Uniwind**（TailwindCSS for React Native）
- 新形態設計（軟卡片、雙陰影、無邊框）
- 主色：翡翠綠 #059669，強調色：琥珀橙 #F97316
- Admin Panel 採用 aistock 風格（窄 sidebar + header + footer）
- 完整調色盤：`DESIGN.md`
