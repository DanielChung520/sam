# SAM App — 導覽選單系統規格

> 2026-07-28
> 資料來源：Playwright 快照 + 原始碼分析

---

## 總覽

SAM 採用 **Tab + Stack** 混合導覽架構，由 Expo Router 驅動。所有頁面透過 `useSafeRouter` Hook 進行參數安全傳遞（Base64 編碼）。

```
Stack (root)
 ├── (tabs)              ← 5 個底部 Tab
 │    ├── news           → 新聞 Tab
 │    ├── friends        → 好友 Tab
 │    ├── index          → 聊天 Tab
 │    ├── broadcast      → 發送 Tab
 │    └── workspace      → 工作區 Tab
 ├── chat-detail         ← Stack 頁面（Slide from right）
 ├── friend-detail
 ├── broadcast-create
 ├── broadcast-holiday
 ├── broadcast-regular
 ├── broadcast-announce
 ├── greeting-cards
 ├── ai-chat
 ├── news (stack route)
 ├── news-settings
 ├── news-settings-time
 ├── card-holder
 ├── sync-friends
 ├── add-friend
 ├── scan
 ├── chat-history
 └── settings
```

---

## 1. 底部 Tab 列 (Bottom Tab Bar)

**元件位置**：`app/(tabs)/_layout.tsx`

始終顯示於畫面底部，共 5 個 Tab：

| # | 名稱 | 路由檔 | FontAwesome6 圖示 | 圖示名稱 |
|---|------|--------|-------------------|----------|
| 1 | 新聞 | `(tabs)/news.tsx` | `newspaper` | 🗞️ |
| 2 | 好友 | `(tabs)/friends.tsx` | `user-group` | 👥 |
| 3 | 聊天 | `(tabs)/index.tsx` | `comment-dots` | 💬 |
| 4 | 發送 | `(tabs)/broadcast.tsx` | `paper-plane` | ✈️ |
| 5 | 工作區 | `(tabs)/workspace.tsx` | `gear` | ⚙️ |

### 視覺規範

- **樣式**：圓角上邊 (`borderTopLeftRadius: 14`, `borderTopRightRadius: 14`)，無邊框線
- **陰影**：向上陰影 (`shadowOffset: { height: -4 }`)，`elevation: 8`
- **間距**：上方 `paddingTop: 12`，下方 `paddingBottom: insets.bottom + 8`
- **標籤文字**：`fontSize: 10`, `fontWeight: '600'`, `marginTop: 2`
- **激活色**：`tabBarActiveTintColor: colors.primary`（翡翠綠）
- **未激活色**：`tabBarInactiveTintColor: colors.tabBarInactive`
- **聊天 Tab 特殊樣式**：激活時圖示放大至 26px，背景使用 `tabActiveBg` 色，48x48 圓形

### 激活指示點

每個 Tab 激活時在圖示下方顯示小圓點：
```
width: 5, height: 5, borderRadius: 2.5, marginTop: 3
backgroundColor: colors.primary
```

---

## 2. 頁面 Header 層級 (每個 Tab 頁)

### 2.1 共同模式

所有 Tab 頁面 Header 共享以下結構：

```
┌────────────────────────────────┐
│  Title            [+] [≡] [🔍] │ ← 操作按鈕（因頁面而異）
│  USB 已連接 · 地端保護模式      │ ← USBStatusBadge 元件
└────────────────────────────────┘
```

- **實作**：每個 Screen 自行管理 header（非共用元件）
- **安全區**：使用 `Screen` 元件時 `safeAreaEdges={['left', 'right']}`，top 由 header 內部自行處理（沉浸式）

### 2.2 各頁 Header 一覽

#### 新聞 Tab

| 項目 | 內容 |
|------|------|
| Title | `新聞追蹤` (22px, 600 weight) |
| 右側按鈕 | ⚙️ 齒輪（漢堡選單 toggle） |
| 漢堡選單 | → 新聞追蹤設置 (`/news-settings`) |
| 次級 UI | 分類 Filter chips：全部 / 今日焦點 / 產業 / 科技 |

**原始碼**：`client/screens/news/index.tsx` — 使用 `useSafeAreaInsets` 手動控制 `paddingTop`

#### 好友 Tab

| 項目 | 內容 |
|------|------|
| Title | `好友` (22px, 600 weight) |
| 右側按鈕 | ⋯ 更多（漢堡選單 toggle） |
| 漢堡選單 | 同步好友 / 添加好友 / 掃一掃 / 名片夾 |
| USB Badge | 顯示於 header 下方 |
| 搜尋列 | 放大鏡 icon + `TextInput` placeholder "搜尋好友..." |
| 標籤 Filter | 水平滾動：全部 / VIP / 高意向 / 決策者 / 沉睡 |

**漢堡選單項目**：

| 項目 | 圖示 | 路由 | 顏色 |
|------|------|------|------|
| 同步好友 | `arrows-rotate` | `/sync-friends` | info |
| 添加好友 | `user-plus` | `/add-friend` | primary |
| 掃一掃 | `qrcode` | `/scan` | sky |
| 名片夾 | `address-card` | `/card-holder` | accent |

**原始碼**：`client/screens/friends/index.tsx`

#### 聊天 Tab

| 項目 | 內容 |
|------|------|
| Title | `對話` (22px, 600 weight) |
| 右側按鈕組 | 🕐 歷史記錄 (`/chat-history`) + 🔍 搜尋 |
| USB Badge | 顯示於 header 下方 |

**原始碼**：`client/screens/chats/index.tsx`

#### 發送 Tab

| 項目 | 內容 |
|------|------|
| Title | `發送` (22px, 600 weight) |
| 右側按鈕 | ⋯ 更多（漢堡選單 toggle） |
| 漢堡選單 | 節日群發 / 定期問安 / 公告群發 |
| USB Badge | 顯示於 header 下方 |

**漢堡選單項目**：

| 項目 | 圖示 | 路由 | 顏色 |
|------|------|------|------|
| 節日群發 | `gift` | `/broadcast-holiday` | accent（琥珀色） |
| 定期問安 | `handshake` | `/broadcast-regular` | sky（天藍色） |
| 公告群發 | `bullhorn` | `/broadcast-announce` | danger（紅色） |

**原始碼**：`client/screens/broadcast/index.tsx`

#### 工作區 Tab

| 項目 | 內容 |
|------|------|
| Title | `工作區` (22px, 600 weight) |
| 右側按鈕 | 無（無漢堡選單） |
| USB Badge | 顯示於 title 下方 |
| 頁面操作選單 | 見下方 §3 |

**原始碼**：`client/screens/workspace/index.tsx`

---

## 3. 工作區內頁選單 (Quick Menu)

工作區 Tab 主體為一系列功能性選單卡片（非下拉式選單）。每個選單項目：

```
┌────────────────────────────────────────┐
│ [icon]  賀卡/問候庫                  > │
│         瀏覽與選取節日賀卡樣板          │
├────────────────────────────────────────┤
│ [icon]  AI 私人聊天室                 > │
│         與 AI 助手自由對話分析          │
├────────────────────────────────────────┤
│ [icon]  新聞追蹤設置                   > │
│         設定關心主題、摘要重點與搜索時間  │
├────────────────────────────────────────┤
│ [icon]  設定                          > │
│         AI 模式、Provider Key、USB 保險箱│
└────────────────────────────────────────┘
```

| # | 圖示 | 標題 | 副標題 | 路由 | iconColor |
|---|------|------|--------|------|-----------|
| 1 | `gift` | 賀卡/問候庫 | 瀏覽與選取節日賀卡樣板 | `/greeting-cards` | accent |
| 2 | `robot` | AI 私人聊天室 | 與 AI 助手自由對話分析 | `/ai-chat` | info |
| 3 | `newspaper` | 新聞追蹤設置 | 設定關心主題、摘要重點與搜索時間 | `/news-settings` | sky |
| 4 | `gear` | 設定 | AI 模式、Provider Key、USB 保險箱 | `/settings` | textSecondary |

**視覺規範**：
- 容器：圓角 20, `padding: 16`, `marginBottom: 10`
- 陰影：`shadowOffset: { width: 4, height: 4 }`, `elevation: 4`
- 圖示區：48x48 圓形，半透明背景色
- 標題：16px, 700 weight
- 副標題：12px, secondary color
- 右箭頭：`chevron-right`, border color

---

## 4. 漢堡選單 (Popup Menu) 共同規範

好友 Tab 與 發送 Tab 使用相同樣式的彈出選單：

### 視覺規範

| 屬性 | 值 |
|------|-----|
| 位置 | `position: absolute`, `top: 52`, `right: 16` |
| 背景色 | `colors.surface` |
| 圓角 | `borderRadius: 16` |
| 陰影 | `elevation: 8` |
| 最小寬度 | `minWidth: 170` |
| 項目間距 | `paddingVertical: 10`, `paddingHorizontal: 14` |
| 圖示 + 文字 | `gap: 10` |

### 行為

- 點擊觸發按鈕 → toggle 顯示/隱藏
- 點擊選單項目 → 關閉選單 + `router.push(pathname)`
- 點擊選單外區域 → 需頁面自行處理關閉（當前無 overlay 點擊關閉機制）

---

## 5. Detail 頁面導覽列 (Navigation Header)

所有 Stack detail 頁面共用以下 Header 模式：

```
┌────────────────────────────────┐
│  ←    頁面標題                 │
└────────────────────────────────┘
```

- **返回按鈕**：FontAwesome6 `chevron-left`（``），點擊呼叫 `router.back()`
- **標題**：頁面對應名稱，如「節日群發」、「設定」等
- **無 USB Badge**：Detail 頁面不顯示 USB 狀態

從 Playwright 截圖確認的 Detail 頁面 Header：

| 路由 | 標題 | Header 特殊元素 |
|------|------|----------------|
| `/friend-detail` | 好友詳情 | 返回 + 名稱 |
| `/chat-detail` | 聊天 | 返回 + 聯絡人名稱 |
| `/chat-history` | 歷史記錄 | 返回 + 🔍（搜尋？） + ``（額外按鈕） |
| `/ai-chat` | AI 私人聊天室 | 返回 + `` icon |
| `/broadcast-create` | 新建群發 | 返回 |
| `/broadcast-holiday` | 節日群發 | 返回 + ℹ️ tooltip |
| `/broadcast-regular` | 定期問安 | 返回 + ℹ️ tooltip |
| `/broadcast-announce` | 公告群發 | 返回 + ℹ️ tooltip |
| `/news-settings` | 新聞追蹤設置 | 返回 |
| `/news-settings-time` | 時間設置 | 返回 |
| `/settings` | 設定 | 返回 |
| `/scan` | 掃一掃 | ✕ 關閉（``） |
| `/add-friend` | 加入好友 | 返回 + 搜尋 |
| `/sync-friends` | 同步好友 | 返回 |
| `/card-holder` | 名片夾 | 返回 + 掃描名片按鈕 |
| `/greeting-cards` | 賀卡/問候庫 | 返回 |

---

## 6. 路由參數傳遞機制

使用 `useSafeRouter` Hook（位置：`client/hooks/useSafeRouter.ts`）：

- **序列化**：`JSON.stringify(params)` → `Base64.encode()` → URL 參數
- **解序列化**：URL 參數 → `Base64.decode()` → `JSON.parse()`
- **支援**：巢狀物件、特殊字元（`%`、`&`、中文、Emoji）、Number/Boolean 類型保留

```typescript
// 發送端
router.push('/chat-detail', { contactId: 123, contactName: '張三' });

// 接收端
const { contactId, contactName } = useSafeSearchParams<{ contactId: number; contactName: string }>();
```

---

## 7. 導覽動畫

- **Stack Push**：`slide_from_right`（從右滑入）
- **Stack Pop**：`slide_from_right` 反轉（從左滑出）
- **手勢返回**：`gestureEnabled: true`, `gestureDirection: 'horizontal'`
- **Tab 切換**：無動畫（即時切換）
- **設定位置**：`app/_layout.tsx`

---

## 8. 選單層級總圖

```
底部 Tab 列（固定顯示）
├── 新聞 Tab
│   └── 漢堡選單 → 新聞追蹤設置
│       └── 時間設置
│
├── 好友 Tab
│   ├── 搜尋列
│   ├── 標籤篩選器
│   ├── 好友卡片 → 好友詳情
│   └── 漢堡選單
│       ├── 同步好友
│       ├── 添加好友
│       ├── 掃一掃
│       └── 名片夾
│
├── 聊天 Tab
│   ├── 聊天卡片 → 聊天詳情
│   ├── 歷史記錄按鈕 → 歷史記錄
│   └── 搜尋按鈕
│
├── 發送 Tab
│   ├── 群發列表
│   └── 漢堡選單
│       ├── 節日群發（6 步驟）
│       ├── 定期問安（4 步驟）
│       └── 公告群發（4 步驟）
│
└── 工作區 Tab
    ├── 儀表板統計
    ├── USB 保險箱管理
    └── 快速選單
        ├── 賀卡/問候庫
        ├── AI 私人聊天室
        ├── 新聞追蹤設置 → 時間設置
        └── 設定
```

---

## 9. 未命名導覽路徑

| 起始頁 | 觸發方式 | 目標頁 |
|--------|---------|--------|
| 發送 Tab 列表 | 點擊群發卡片（尚未實作） | 群發詳情（尚未實作） |
| 新聞 Tab | 點擊新聞卡片 | 新聞詳情（App 內嵌，非獨立頁面） |
| 好友 Tab | 搜尋結果為空 | 無結果狀態（內嵌顯示） |
