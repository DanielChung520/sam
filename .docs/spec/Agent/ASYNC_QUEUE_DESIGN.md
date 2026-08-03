# 異步並發佇列 + 帳號隔離 Orchestration — 設計

> 版本：v0.1（討論中）
> 日期：2026-08-03
> 狀態：**草案，待 user 確認後實作**
> 目標：LINE webhook 從「同步阻塞」升級為「異步並發佇列」，每 channel 完全隔離，系統可調度最大排程

---

## 0. 背景與動機

### 現況問題

```
LINE 訊息 → webhook → await pipeline.handleMessage() → 完成才回 200
                              │
                              └─ taskforge 阻塞 300s 時，LINE 一直等
```

| 問題 | 後果 |
|------|------|
| webhook 同步阻塞 | 慢任務（taskforge /write 300s）時 LINE 連線掛著 |
| 全 server 單一 pipeline | 一個 channel 的慢任務拖住所有 channel |
| 無並發調度 | 無法利用 128GB 機器能力 |

### 目標（user 確認）

1. **同一組代碼** — factory pattern，一份 code 多個 instance
2. **其他完全隔離** — 每 channel 的狀態 / queue / 設定全隔離
3. **排隊不阻塞** — A 帳號慢任務不拖住 B
4. **異步並發佇列** — 收到訊息即回 200，背景並發處理，完成後 push 結果
5. **LINE push 已確認** — 會開 push message 權限，有 userId 區別

---

## 1. 整體架構

```
LINE user
  │ 訊息
  ▼
webhook（編排層 — 共享、無狀態、輕量）
  1. signature 驗證
  2. destination → channel（ArangoDB 查詢）
  3. Registry.get(channelId) → AgentInstance（Orchestration 自動綁定，admin 不需選擇）
  4. 入 instance 的 async queue
  5. 立即回 200 ✅（不阻塞）
  │
  ▼
AgentInstance（每 channel 一個，完全隔離）
  ├─ async queue（自己的訊息佇列）
  ├─ worker（從全局並發池取 slot）
  ├─ pipeline（自己的 PolarisPipeline）
  ├─ conversation store（已 channelId 隔離）
  └─ config（從 channel document 讀：model/rateLimit/push 設定）
  │
  ▼ 處理完成
LINE push message（推結果給 user）— 用 channel 的 accessToken + userId
```

---

## 2. Channel 設定卡新增欄位

| 欄位 | 型別 | 預設 | 說明 |
|------|------|------|------|
| `pushEnabled` | boolean | true | 是否啟用 push 回覆（LINE 需開 push 權限）|
| `ackEnabled` | boolean | true | 是否先回「處理中...」ack（慢任務時）|
| `ackMessage` | string | 「收到，處理中...」 | ack 文案 |
| `concurrencyLimit` | number | 2 | 此 channel 同時最多幾個 worker（預設 2）|
| `queuePriority` | number | 0 | 佇列優先權（越高越先處理）|

> `concurrencyLimit` 是 per-channel 上限；全局還有總上限（見 §4）。

---

## 3. Async Queue 設計

### 3.1 結構

```typescript
interface QueueItem {
  id: string;              // uuid
  channelId: string;
  userId: string;          // LINE userId（push 用）
  replyToken?: string;     // 若還可用 replyToken（3 秒內）優先 reply，否則 push
  event: WebhookEvent;     // 原始事件
  enqueuedAt: number;
  attempts: number;        // 重試次數
}

class AsyncQueue {
  private items: QueueItem[] = [];   // FIFO + priority
  private running = 0;               // 目前執行中
  readonly limit: number;            // per-channel concurrency
}
```

### 3.2 行為

- **入隊**：`enqueue(item)` → 立即嘗試 dequeue（若 running < limit）
- **出隊**：`dequeue()` → running < limit 時取出最高優先 + 最早入隊的 item
- **完成**：處理完（成功/失敗）→ running-- → 再 dequeue（串行補位）
- **順序保證**：同 channel 同 worker 處理中，下一條不會超前（FIFO 除非 priority 更高）

---

## 4. 全局 Worker Pool

```typescript
class WorkerPool {
  private maxWorkers: number;      // 全局總上限（user 決定 = 4，初期人不多 + LLM 是主要執行資源）
  private active: Map<string, AsyncQueue>;  // channelId → queue
  private runningCount = 0;

  async submit(channelId: string, item: QueueItem): Promise<void> {
    // 1. 找 channel 的 queue（沒有就建）
    // 2. 入隊
    // 3. 若 runningCount < maxWorkers → 啟動 worker 處理
  }
}
```

### 並發調度

```
全局上限 4 ── 分配給各 channel
  Channel A limit=2 ──→ 最多同時 2 條 A 的訊息
  Channel B limit=4 ──→ 最多同時 4 條 B 的訊息
  Channel C limit=2 ──→ 2 條
  ... 總和 ≤ 4
```

---

## 5. webhook 修改

```
目前：await pipeline.handleMessage() → 回 200
改為：
  const instance = registry.get(channelId)
  instance.queue.enqueue({ event, userId, channelId })
  res.status(200).end()          // 立即回 200
```

### 背景 worker 處理流程

```
worker 取出 item
  ├─ 若 ackEnabled → 先回「處理中...」（replyToken 或 push）
  ├─ pipeline.handleMessage(...)
  ├─ 完成 → push/reply 結果
  └─ 失敗 → 重試（attempts < 3）或 push 錯誤訊息
```

---

## 6. 回覆機制（reply vs push）

| 時機 | 用 replyToken | 用 push |
|------|--------------|---------|
| 3 秒內完成 | ✅ reply（免費、無 push 配額）| ❌ |
| 超過 3 秒（ack 後）| ❌ replyToken 已過期 | ✅ push（需 channel 開 push 權限）|

> LINE reply 只能在收到訊息後 3 秒內用；超過就要 push。所以：
> - 快任務 → reply（省 push 配額）
> - 慢任務 → ack（reply）+ 完成後 push

---

## 7. AgentRegistry（每 channel instance）

```typescript
class AgentRegistry {
  private instances = new Map<string, AgentInstance>();
  private config: RegistryConfig;

  async get(channelId: string): Promise<AgentInstance> {
    if (this.instances.has(channelId)) return this.instances.get(channelId)!;
    const instance = await this.build(channelId);   // 讀 channel doc → 建 instance
    this.instances.set(channelId, instance);
    return instance;
  }

  invalidate(channelId: string): void {
    this.instances.delete(channelId);   // admin 改設定時呼叫
  }

  // 回收策略：閒置 > 24h 的 instance 釋放（Redis 狀態仍在，重建便宜）
}
```

---

## 8. 需要確認的決策

| # | 問題 | 我的建議 |
|---|------|---------|
| 1 | 全局並發上限 | **4**（user 決定：初期不多人 + LLM 是主要執行資源）|
| 2 | 每 channel 預設 concurrencyLimit | **2** |
| 3 | ack 策略 | **慢任務才 ack**（taskforge > 3s 預估才回「處理中」）|
| 4 | 重試 | 失敗重試 **3 次**（間隔 1s/5s/30s）|
| 5 | instance 回收 | 閒置 **24h** 回收 |
| 6 | 設定變更生效 | admin 存 channel 時 call `registry.invalidate()` 即時生效 |

---

## 9. 檔案變更

### 新增
- `server/src/agent/asyncQueue.ts` — per-channel async queue
- `server/src/agent/workerPool.ts` — 全局並發池
- `server/src/agent/agentRegistry.ts` — Map<channelId, AgentInstance>

### 修改
- `server/src/routes/webhook.ts` — 改為「入隊 + 立即 200」
- `server/src/agent/pipeline.ts` — 支援 async 模式（ack + push 結果）
- `server/src/data/channelRepo.ts` — 新增 push/ack/concurrency 欄位
- `server/src/routes/adminChannels.ts` — 接收新欄位
- `admin/src/pages/Channels.tsx` — 設定卡加 push/ack/concurrency 區塊

---

## 10. 驗證

- 單元：queue 順序、priority、limit 正確
- 並發：A 帳號 taskforge 300s 同時 B 帳號訊息秒回
- push：超過 3s 的任務用 push 推結果
- 隔離：兩 channel 的 instance 狀態不互相影響
