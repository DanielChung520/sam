# SAM App — 規格文件索引

> 最後更新：2026-07-28
> 產生方式：Playwright 自動化擷取 + AI 生成
> 總頁面數：21（5 個 Tab + 16 個 Detail 頁面）

---

## 規格文件列表

| # | 文件 | 涵蓋功能頁面 |
|---|------|-------------|
| 1 | [`navigation-menu-spec.md`](navigation-menu-spec.md) | 底部 Tab 列、各頁 Header、漢堡選單、路由架構 |
| 2 | [`news-tab-spec.md`](news-tab-spec.md) | 新聞 Tab、新聞追蹤設置、時間設置 |
| 3 | [`friends-tab-spec.md`](friends-tab-spec.md) | 好友 Tab、好友詳情、加入好友、同步好友 |
| 4 | [`chat-tab-spec.md`](chat-tab-spec.md) | 聊天 Tab、聊天詳情、歷史記錄、AI 私人聊天室 |
| 5 | [`broadcast-tab-spec.md`](broadcast-tab-spec.md) | 發送 Tab、新建群發、節日群發、定期問安、公告群發 |
| 6 | [`workspace-tab-spec.md`](workspace-tab-spec.md) | 工作區 Tab、設定、新聞追蹤設置、時間設置 |
| 7 | [`card-holder-spec.md`](card-holder-spec.md) | 名片夾、賀卡/問候庫、掃一掃 |
| 8 | [`斜線指令.md`](斜線指令.md) | `/` 指令系統（多輪互動、選單、pendingArg 狀態）|

## 頁面對應表

### Tab 頁面（5）

| Tab | 路由 | 檔案位置 | 規格文件 |
|-----|------|---------|---------|
| 新聞 | `(tabs)/news.tsx` | `screens/news/` | news-tab-spec.md |
| 好友 | `(tabs)/friends.tsx` | `screens/friends/` | friends-tab-spec.md |
| 聊天 | `(tabs)/index.tsx` | `screens/chats/` | chat-tab-spec.md |
| 發送 | `(tabs)/broadcast.tsx` | `screens/broadcast/` | broadcast-tab-spec.md |
| 工作區 | `(tabs)/workspace.tsx` | `screens/workspace/` | workspace-tab-spec.md |

### Stack Detail 頁面（16）

| 路由 | 畫面目錄 | 規格文件 |
|------|---------|---------|
| `/friend-detail` | `screens/friend-detail/` | friends-tab-spec.md |
| `/add-friend` | `screens/add-friend/` | friends-tab-spec.md |
| `/sync-friends` | `screens/sync-friends/` | friends-tab-spec.md |
| `/chat-detail` | `screens/chat-detail/` | chat-tab-spec.md |
| `/chat-history` | `screens/chat-history/` | chat-tab-spec.md |
| `/ai-chat` | `screens/ai-chat/` | chat-tab-spec.md |
| `/broadcast-create` | `screens/broadcast-create/` | broadcast-tab-spec.md |
| `/broadcast-holiday` | `screens/broadcast-holiday/` | broadcast-tab-spec.md |
| `/broadcast-regular` | `screens/broadcast-regular/` | broadcast-tab-spec.md |
| `/broadcast-announce` | `screens/broadcast-announce/` | broadcast-tab-spec.md |
| `/settings` | `screens/settings/` | workspace-tab-spec.md |
| `/news-settings` | `screens/news-settings/` | news-tab-spec.md |
| `/news-settings-time` | `screens/news-settings-time/` | news-tab-spec.md |
| `/card-holder` | `screens/card-holder/` | card-holder-spec.md |
| `/greeting-cards` | `screens/greeting-cards/` | card-holder-spec.md |
| `/scan` | `screens/scan/` | card-holder-spec.md |

---

## Screenshots

所有頁面的 Playwright 截圖位於：[`.playwright-mcp/`](../../.playwright-mcp/)

| 檔案 | 對應頁面 |
|------|---------|
| `screenshot-chat-tab.png` | 聊天 Tab |
| `screenshot-news-tab.png` | 新聞 Tab |
| `screenshot-friends-tab.png` | 好友 Tab |
| `screenshot-friend-detail.png` | 好友詳情 |
| `screenshot-broadcast-tab.png` | 發送 Tab |
| `screenshot-broadcast-create.png` | 新建群發 |
| `screenshot-broadcast-holiday.png` | 節日群發 |
| `screenshot-broadcast-regular.png` | 定期問安 |
| `screenshot-broadcast-announce.png` | 公告群發 |
| `screenshot-chat-detail.png` | 聊天詳情 |
| `screenshot-chat-history.png` | 歷史記錄 |
| `screenshot-ai-chat.png` | AI 私人聊天室 |
| `screenshot-workspace-tab.png` | 工作區 Tab |
| `screenshot-settings.png` | 設定 |
| `screenshot-news-settings.png` | 新聞追蹤設置 |
| `screenshot-news-settings-time.png` | 時間設置 |
| `screenshot-scan.png` | 掃一掃 |
| `screenshot-add-friend.png` | 加入好友 |
| `screenshot-sync-friends.png` | 同步好友 |
| `screenshot-card-holder.png` | 名片夾 |
| `screenshot-greeting-cards.png` | 賀卡/問候庫 |

---

## 相關文件

- [導覽選單系統規格](navigation-menu-spec.md)
- [SAM 系統規格](../SAM_System_Specification.md)
- [SAM Mobile Coze 規格](../SAM_Mobile_Coze_Spec.md)
- [Broadcast 功能規格 (v1)](broadcast-spec.md)
- [Playwright Handoff 記錄](playwright-handoff.md)
