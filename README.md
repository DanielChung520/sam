# SAM — LINE 代理（LINE Agent Platform）

多租戶 LINE OMO 助手平台。業務員申請自己的 LINE Channel → 產生分身助手 → 客戶加好友即可使用 AI 對話、CRM、群發等功能。所有分身共用統一後台 Agent，透過 **Person Token** 隔離資料。

> 架構與設計文件統一放在 [`.docs/`](.docs/AGENT_LAYER_ARCHITECTURE.md)（單一真相）。開發者指引見 [AGENTS.md](AGENTS.md)。

## 架構總覽

```
LINE user → la.aiconn.ai (proxy:7010) → Express:9091 (API + Webhook)
                                        └→ Agent Layer（intent → skill → memory → reply）
             admla.aiconn.ai (Vite:7012) → 管理後台（Agent Center / Skills / Channels...）
             ArangoDB:8529 / Redis:6379 / Qdrant / SeaweedFS（host-level infra）
```

## 服務埠號

| 埠 | 服務 |
|----|------|
| 7010 | PWA proxy（serve `client/dist/` + proxy API/Webhook → 9091） |
| 7011 | Expo dev server |
| 7012 | Admin Panel（Vite） |
| 8529 | ArangoDB（共用 instance, DB=`sam`） |
| 9091 | Express backend（API + Webhook） |
| 9092 | Rust API Gateway（sam-service） |

## 快速啟動

> 基礎服務（ArangoDB:8529、Redis:6379、SeaweedFS、Qdrant）由 host-level infra 管理，確認已在跑即可。

```bash
# 1. Express API server（:9091）
tmux new-session -d -s sam-server -c server "npx tsx src/index.ts"

# 2. PWA proxy（:7010，需先 production build 過才有 client/dist/）
tmux new-session -d -s sam-proxy -c client "node scripts/proxy.mjs"

# 3. Admin Panel（:7012）
tmux new-session -d -s sam-admin -c admin "npm run dev"
```

Production build（更新前端後才需要）：

```bash
cd client && npx expo export -p web && node scripts/post-build.mjs
```

### 驗證

```bash
curl http://localhost:8529/_api/version          # ArangoDB
curl http://localhost:9091/api/v1/health         # Express → {"status":"ok"}
curl -o /dev/null -w "%{http_code}" http://localhost:7010/   # PWA → 200
curl -o /dev/null -w "%{http_code}" http://localhost:7012/   # Admin → 200
```

### Admin e2e 測試

```bash
npx playwright test   # 10 tests（admin/e2e/admin-verify.spec.cjs），需 :7012 + :9091 在跑
```

## 管理後台

| 項目 | 說明 |
|------|------|
| 網址 | `https://admla.aiconn.ai`（本機 `http://localhost:7012`） |
| 預設帳號 | 見 `admin/.env`（目前為 dev auto-login：username 當 channelId，密碼未驗證） |
| 頁面 | Dashboard / Accounts / Channels / Cards / Agent Center / Skills / Knowledge(Business Docs) / Files / MCP |

## Monorepo（pnpm workspace）

```
sam/
├── client/    Expo (React Native Web) — 一般使用者前端
├── admin/     Vite + React + TS — 平台管理後台
├── server/    Express.js 後端（API + LINE Webhook + Agent Layer）
├── service/   Rust (Axum) API Gateway
├── web/       官方網站（預留）
├── .docs/     架構/設計/規格文件（單一真相）
└── eslint-plugins/
```

## 目前階段

- ✅ 5 Tab + 16 Detail 頁面 UI、PWA build
- ✅ Agent Layer 全 7 phases（webhook 已接 pipeline）
- ✅ Admin Panel（Agent Center、Skills 流程編輯器、14 條 admin API）
- ✅ Admin e2e 10/10 通過
- ⬜ 登入頁面整合（Expo App AuthContext）
- ⬜ 多租戶管理後台串接真實 LINE Channel 資料
