// Per-channel async queue
//
// 每個 channel 一個 AsyncQueue：
//   - FIFO + priority（queuePriority 越高越先處理）
//   - concurrencyLimit 控制同時處理數量
//   - 同 channel 內不互相阻塞（多 worker 並發）
//
// 與全局 WorkerPool 搭配：queue 決定「順序與上限」，pool 決定「全局最多幾個在跑」。

export interface QueueItem {
  id: string;
  channelId: string;
  userId: string;
  payload: unknown;
  enqueuedAt: number;
  attempts: number;
}

export class AsyncQueue {
  readonly channelId: string;
  private items: QueueItem[] = [];
  private running = 0;
  private limit: number;
  private onAvailable: (() => void) | null = null;

  constructor(channelId: string, limit = 2) {
    this.channelId = channelId;
    this.limit = limit;
  }

  enqueue(item: QueueItem): void {
    this.items.push(item);
    this.notify();
  }

  /** 取出下一個可處理的 item（running < limit 且有等待項時） */
  dequeue(): QueueItem | null {
    if (this.running >= this.limit) return null;
    if (this.items.length === 0) return null;
    // priority 高的先（queuePriority 越大越前），同 priority 依入隊順序
    const idx = this.items.reduce((best, cur, i) => {
      const bestP = (this.items[best].payload as any)?.queuePriority ?? 0;
      const curP = (cur.payload as any)?.queuePriority ?? 0;
      return curP > bestP ? i : best;
    }, 0);
    const [item] = this.items.splice(idx, 1);
    this.running++;
    return item;
  }

  complete(): void {
    this.running--;
    this.notify();
  }

  get length(): number {
    return this.items.length;
  }

  get activeCount(): number {
    return this.running;
  }

  get isAvailable(): boolean {
    return this.running < this.limit && this.items.length > 0;
  }

  /** 有可處理項目時通知（供 worker pool 使用） */
  setAvailableCallback(fn: (() => void) | null): void {
    this.onAvailable = fn;
  }

  private notify(): void {
    if (this.isAvailable && this.onAvailable) this.onAvailable();
  }
}
