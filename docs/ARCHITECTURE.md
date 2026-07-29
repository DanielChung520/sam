# LINE 代理 — 產品架構文件

> 最後更新：2026-07-28

## 產品定位

「LINE 代理」是一個 **多租戶 LINE OMO 助手平台**：

- 業務員申請自己的 LINE Channel → 產生分身助手 → 讓客戶加好友
- 分身助手提供 **AI 對話、CRM、群發、新聞追蹤** 等功能
- 所有分身共用統一後台 Agent，透過 **Person Token** 隔離資料

## 核心架構

```
業務員 A (LINE Channel A)         業務員 B (LINE Channel B)
        │                                  │
  客戶加 Bot A                         客戶加 Bot B
        │                                  │
  ┌─────▼──────────────────────────────────▼──────┐
  │                LINE Platform                   │
  │   - Messages API (Webhook)                     │
  │   - LIFF (內嵌頁面，無瀏覽器控制項)              │
  │   - Rich Menu (浮動選單)                       │
  └─────┬──────────────────────────────────┬──────┘
        │                                  │
  ┌─────▼──────────────────────────────────▼──────┐
  │              統一後端平台                       │
  │                                                │
  │  認證層：Channel ID → 辨識業務員                │
  │                ↓                                │
  │  Agent 層：統一 AI + Person Token 隔離          │
  │                ↓                                │
  │  功能層：對話 / CRM / 群發 / 新聞 / 名片...     │
  │                ↓                                │
  │  資料層：SeaweedFS + SQLite-vec + AES-256 USB   │
  └─────────────────────────────────────────────────┘
```

## 技術棧（現狀）

| 層級 | 技術 |
|------|------|
| 前端框架 | Expo (React Native Web) |
| UI 樣式 | Uniwind (TailwindCSS for RN) |
| 路由 | Expo Router (Tabs + Stack) |
| 圖示 | FontAwesome6 |
| 後端 | Express.js |
| 授權 | LINE LIFF + JWT (待實作) |
| 部署 | 靜態檔 (dist/) + Node proxy |
| 對外 | Tailscale Funnel → la.aiconn.ai:7010 |

## 目前進度

### ✅ 已完成

- **所有 Tab 頁面開發完成**
  - 新聞追蹤（含篩選 Tab、設定選單）
  - 好友 CRM（搜尋、標籤篩選、詳情、掃一掃、名片夾）
  - 聊天（對話列表、歷史、AI 聊天室）
  - 群發（節日/定期/公告 三種流程）
  - 工作區（儀表板、USB 保險箱、設定選單）
- **21 頁 UI 全部擷取並產出規格文件**
- **production build 流程**（expo export + post-build）
- **PWA service worker**（可安裝）
- **AccountAvatar 元件**（預留 AuthContext 串接）

### 🔲 待實作

#### Phase 1 — LIFF 整合（目前優先）
- [ ] 前端安裝 `@line/liff`
- [ ] LIFF Provider（初始化、getProfile、token 管理）
- [ ] AuthContext 改接 LINE token + 後端 JWT
- [ ] 後端 `POST /api/v1/auth/line`（驗證 LINE token）
- [ ] 保護路由（未登入導向 LINE Login）
- [ ] 浮動選單（Rich Menu）規劃

#### Phase 2 — AI Agent 整合
- [ ] Webhook route（接收 LINE Messages）
- [ ] Agent 統一調用層（Person Token 隔離）
- [ ] AI 對話回覆（MoE Router 架構）
- [ ] 名片 OCR 辨識建檔

#### Phase 3 — 多租戶管理後台
- [ ] 官方網站（註冊/登入）
- [ ] LINE Channel 申請引導流程
- [ ] Channel ID/Secret 設定頁
- [ ] Webhook 動態註冊
- [ ] 各業務員資料隔離

### 🔒 現階段不處理

- Android APK（EAS Build）
- iOS App（Apple Developer $99/年）
- Play Store / App Store 上架

## LIFF 整合架構

```
LINE App 內
  ┌─────────────────────┐
  │  LIFF WebView       │  ← 無瀏覽器 UI
  │  (la.aiconn.ai)     │
  │                     │
  │  liff.init()         │
  │  liff.getProfile()   │  ← LINE 用戶資料
  │  liff.getAccessToken()│ ← LINE Token
  └─────────┬───────────┘
            │ POST /api/v1/auth/line
            ▼
  ┌─────────────────────┐
  │  後端驗證 LINE Token │  ← Channel Secret 驗證
  │  發放 JWT           │
  │  回傳 user 資料      │
  └─────────┬───────────┘
            │ 存入 AuthContext
            ▼
  ┌─────────────────────┐
  │  進入主畫面          │
  │  (所有頁面)          │
  └─────────────────────┘
```

## 開發環境

```bash
# 啟動後端
cd server && npx tsx src/index.ts

# 啟動前端 dev server（port 7011）
cd client && PORT=7011 npx expo start --web --port 7011

# Production build
cd client && npx expo export -p web && node scripts/post-build.mjs

# Proxy（port 7010，對外）
cd client && node scripts/proxy.mjs
```

## 來源

- 完整規格：`.docs/spec/index.md`
- 設計系統：`DESIGN.md`
- LINE OMO 原 spec：`docs/SAM_System_Specification.md`
