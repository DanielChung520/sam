# 7010 App 真實資料對接計劃

> 版本：v0.1
> 日期：2026-08-03
> 狀態：**待實作**（測試先行）
> 目標：7010 Web App 從離線 mock 逐步更換為真實 server API + LINE 資料

---

## 0. 現況盤點

```
Client（11 screens）──全部──→ utils/mockApi.ts（前端離線 mock）✗ 沒打 server
Server（4 routers）──全部──→ data/mock.js（後端 mock）✗ 沒人呼叫
LINE SDK v11 ──只用了 reply/push/getMessageContent──→ 未用 profile/followers
```

**關鍵**：
- client 與 server 的 mock 結構**完全一致**（同源 mirror）→ 接線成本低
- proxy(7010) 已轉發 `/api/*` → Express(9091)
- 登入 token 存 `sam_token`（AuthContext）
- 已有 2 個 LINE channel 對應 2 個帳號（一般 LINE BOT 型態）

## 1. 對接對照表

| Screen | client mock | server 端點 | 真實資料來源 |
|--------|------------|------------|------------|
| chats | getChats | GET /api/v1/chats | messages collection（webhook 落庫）|
| chat-detail | getChatDetail/postMessage | GET/POST /api/v1/chats/:id/messages | messages + pushMessage |
| friends | getContacts | GET /api/v1/contacts | contacts collection（webhook 累積 + getProfile）|
| friend-detail | getContactDetail | GET /api/v1/contacts/:id | contacts collection |
| broadcast | getBroadcasts | GET /api/v1/broadcasts | broadcast_tasks collection |
| broadcast-create/regular/holiday/announce | createBroadcast | POST /api/v1/broadcasts | broadcast_tasks + multicast |
| news | getNews | GET /api/v1/news | 外部新聞來源（app 自有）|
| greeting-cards | getGreetings | GET /api/v1/greetings | greeting_templates（app 自有）|

## 2. 三階段

### Phase 1：Client 接線（mock → server API）
- 新增 `client/utils/api.ts`（fetch 封裝：相對 `/api/v1` + Bearer token + `{data}` 解析）
- 11 個 screen 的 import 從 `utils/mockApi` 換成 `utils/api`
- server 端維持 mock（架構打通、可測）

### Phase 2：Server 真實化（mock → ArangoDB + LINE）
- 新增 `src/lib/lineClient.ts`（抽 webhook 的 client factory + channel cache）
- 新增 `contactRepo.ts` / `messageRepo.ts` / `broadcastRepo.ts`
- webhook 處理 follow/unfollow + 訊息落庫 + getProfile 快取

### Phase 3：真實 LINE 互動
- contacts：webhook 被動累積 + getProfile 補資料
- chats：pushMessage 發送、getMessageContent 收多媒體
- broadcasts：multicast 群發 + 進度追蹤

## 3. 資料模型（新增 collection）

### contacts
```
_key: 'c:{channelId}:{userId}'
channelId, userId, displayName, pictureUrl, statusMessage,
tags[], score, lastMessageAt, unreadCount, isBlocked, followedAt
```

### messages
```
_key: 'm:{channelId}:{userId}:{messageId}'
channelId, userId, direction: 'in'|'out', type, text,
mediaUrl/storageKey, createdAt
```

### broadcast_tasks
```
_key: uuid
channelId, title, status, template, contactIds[], total, sent,
createdAt, scheduledAt, completedAt
```

## 4. 單元測試計劃（測試先行）

### client（jest，client/__tests__/）
- **api.ts**：mock fetch → 驗證帶 token、正確 URL、`{data}` 解析、錯誤處理
  - 每函數（getChats/getContacts/...）回傳結構測試

### server（tsx test-*.mts）
- **lineClient.test**：channel cache（60s TTL）、正確建立 client、無 token fallback
- **contactRepo.test**：upsert/get/list、channel 隔離
- **messageRepo.test**：寫入/讀取、方向標記、channel 隔離
- **broadcastRepo.test**：CRUD、狀態轉換
- **webhook 事件處理**：follow → 建 contact；message → 落庫；getProfile 快取

## 5. 已知決策點

1. **一般 LINE BOT**：getFollowers 不可用 → 好友靠 webhook 被動累積（follow 事件 + 來訊）
2. **assistantChat(id=0)**：server 端點沒有置頂 AI 助理 → client 需自行注入或 server 補端點
3. **broadcast wizard 排程參數**：regular/holiday/announce 的排程/間隔/圖片目前沒傳 createBroadcast → 真實 API 需擴充 payload
4. **holiday AI 生成**：目前本地模擬（AI_TEMPLATES + setTimeout）→ 真實對接需 AI 生成端點
5. **受眾來源三處重複**：broadcast-create/regular/holiday 各自維護 mock 好友 → 統一改接 getContacts
