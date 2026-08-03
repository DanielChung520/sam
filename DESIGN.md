# SAM Mobile — Design System

> 版本：2.0.0 ｜ 最後更新：2026-08-03
> 與 `client/theme/colors.ts` 實作同步。改色彩前先更新此文件。

## Product Identity

SAM (Sales Assistant Manager) — 隱私優先的銷售 CRM，結合 LINE 風格的訊息介面與智慧客戶管理。實體隱喻：**皮革質感的高階業務手帳** × **加密保險箱** — 溫暖、可觸、值得信賴，底層帶有高技術安全感的氛圍。

## Visual Strategy

- **攝影**：專業頭像、溫暖辦公環境
- **圖形**：翡翠綠調的極簡線條圖示，熱度徽章用火/種子/沉睡隱喻
- **USB 保險箱**：以盾牌/鎖頭微圖案呈現

## Color Palette（與 `colors.ts` 同步）

| Token | Value | 用途 |
|-------|-------|------|
| `primary` | `#059669`（翡翠綠）| 信任、成長、銷售成功 |
| `primary08/10/12/30` | emerald 透明階層 | 標籤背景、圖示容器、選中狀態 |
| `accent` | `#F97316`（琥珀橙）| 熱度分數、緊急 |
| `bg` | `#F0F2F5` | App 背景（新形態基底）|
| `bgSecondary` | — | 輸入框/次要表面 |
| `surface` | `#F0F2F5` | 卡片表面（同 bg，新形態）|
| `surfaceAlt` | — | 交替卡片（AI 聊天氣泡）|
| `text` | `#1E293B`（slate-800）| 主文字 |
| `textSecondary` | `#64748B`（slate-500）| 次要文字 |
| `textTertiary` | `#94A3B8`（slate-400）| 三級文字 |
| `textOnPrimary` | `#FFFFFF` | 主色按鈕文字 |
| `chatSent` | `#059669` | 送出訊息氣泡 |
| `chatReceived` | `#FFFFFF` | 接收訊息氣泡 |
| `usbConnected` | `#10B981` | USB 已連接（安全、本機保護）|
| `usbDisconnected` | `#EF4444` | USB 未連接（警示）|
| `usbConnecting` | `#F59E0B` | USB 連線中 |
| `shadowDark` | `#C8CFD8` | 冷灰陰影 |
| `shadowLight` | `#FFFFFF` | 白色高光 |

## Typography

| Element | Size | Weight |
|---------|------|--------|
| 標題（Titles）| 28px | 800 |
| Section headers | 18px | 700 |
| 卡片標題 | 16px | 700 |
| Body | 14px | 400 |
| Labels | 13px | 600 |
| Tab 標籤 | 10px | 600 |

## Key Design Decisions

- **新形態軟卡片**（雙陰影）用於所有卡片
- **LINE 風聊天氣泡**：翡翠綠送出 / 白色接收
- **熱度徽章**：pill 標籤 + emoji + 漸層（🔥🔥 高 / 🔥 中 / 🌱 低 / 💤 沉睡）
- **USB 狀態**：每頁頂部彩色徽章
- **底部 Tab bar**：圓角上緣 + 向上陰影
- **無邊框** — 深度靠陰影呈現

## Design Don'ts

- ❌ 白色卡片背景（用 `#F0F2F5`）
- ❌ 邊框式分隔
- ❌ 矩形選中指示
- ❌ 冷藍色系
- ❌ 通用科技感美學

## 前端元件原則

- 共用元件集中在 `client/components/`（`Screen`、`AccountAvatar`、`USBStatusBadge`、`ScoreBadge`...）
- 頁面實作在 `client/screens/<tab>/`，每 Tab 一目錄
- 色彩一律從 `useTheme()` / `useThemedStyles` 取 token，嚴禁硬編碼色值
- 視覺相關工作委託 `visual-engineering` agent

## Admin Panel（管理後台）

- **aistock 風格**：窄 sidebar + header + footer
- 主色翡翠綠 `#059669`、強調琥珀橙 `#F97316`（與 App 一致）
- 元件見 `admin/src/components/`（Layout, Sidebar, Header, Footer, FlowEditor）
- 樣式集中在 `admin/src/styles/theme.css`

## 修改歷程

| 日期 | 版本 | 更新者 | 變更內容 |
|------|------|--------|----------|
| 2026-08-03 | 2.0.0 | Sisyphus | 擴充為完整設計系統（token 表格與 colors.ts 同步、元件原則、Admin 規範）|
| 2026-07 | 1.0.0 | Daniel Chung | 初始版本 |
