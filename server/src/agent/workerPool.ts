// Global worker pool — 異步並發佇列的調度核心
//
// 全局上限 maxWorkers（user 決定 = 4）：
//   - 每個 channel 有自己的 AsyncQueue（limit = concurrencyLimit）
//   - pool 決定「全局同時最多幾個 worker 在跑」
//   - channel 的 queue 有可處理項目 → 向 pool 請求 slot
//   - slot 有空 → 啟動 worker 處理該 item；無空 → 等待

import { AsyncQueue, type QueueItem } from './asyncQueue.js';

export const DEFAULT_MAX_WORKERS = 4;

export type WorkerHandler = (item: QueueItem, queue: AsyncQueue) => Promise<void>;

export class WorkerPool {
  private readonly maxWorkers: number;
  private handler: WorkerHandler;
  private handlerSet = false;
  private readonly queues = new Map<string, AsyncQueue>();
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(handler: WorkerHandler, maxWorkers = DEFAULT_MAX_WORKERS) {
    this.handler = handler;
    this.maxWorkers = maxWorkers;
  }

  /** 設定 worker 處理邏輯（webhook 層註冊，每個 pool 一次） */
  setHandler(fn: WorkerHandler): void {
    this.handler = fn;
    this.handlerSet = true;
  }

  get isHandlerSet(): boolean {
    return this.handlerSet;
  }

  /** 取得（或建立）channel 的 queue */
  getQueue(channelId: string, limit = 2): AsyncQueue {
    let q = this.queues.get(channelId);
    if (!q) {
      q = new AsyncQueue(channelId, limit);
      q.setAvailableCallback(() => this.pump());
      this.queues.set(channelId, q);
    } else {
      // 動態更新 limit（設定變更時）
      (q as unknown as { limit: number }).limit = limit;
    }
    return q;
  }

  /** 入隊一條訊息（webhook 呼叫） */
  async submit(channelId: string, item: QueueItem, limit = 2): Promise<void> {
    const q = this.getQueue(channelId, limit);
    q.enqueue(item);
    this.pump();
  }

  /** 有空間就啟動 worker */
  private pump(): void {
    while (this.running < this.maxWorkers) {
      const entry = this.nextQueue();
      if (!entry) break;
      const { queue, item } = entry;
      this.running++;
      this.runWorker(queue, item).finally(() => {
        this.running--;
        queue.complete();
        this.pump();
      });
    }
  }

  /** 找下一個「有可處理項目」的 queue（round-robin 簡單遍歷） */
  private nextQueue(): { queue: AsyncQueue; item: QueueItem } | null {
    for (const [, q] of this.queues) {
      if (q.isAvailable) {
        const item = q.dequeue();
        if (item) return { queue: q, item };
      }
    }
    return null;
  }

  private async runWorker(queue: AsyncQueue, item: QueueItem): Promise<void> {
    try {
      await this.handler(item, queue);
    } catch (e) {
      console.error(`[workerPool] channel ${queue.channelId} item ${item.id} failed:`, e);
    }
  }

  get runningCount(): number {
    return this.running;
  }

  get queueCount(): number {
    return this.queues.size;
  }

  /** 清理閒置 queue（instance 回收時） */
  removeQueue(channelId: string): void {
    const q = this.queues.get(channelId);
    if (q && q.length === 0 && q.activeCount === 0) {
      this.queues.delete(channelId);
    }
  }
}
