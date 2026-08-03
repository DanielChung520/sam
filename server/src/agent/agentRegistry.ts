// Agent Registry — 每 channel 一個 AgentInstance（帳號隔離）
//
// 同一組代碼（factory pattern），每個 channel 的 instance 完全隔離：
//   - 自己的 pipeline / agent / executor
//   - 自己的 queue（經 WorkerPool）
//   - 設定從 channel document 讀（lazy init）
//
// 回收：閒置超過 IDLE_RECYCLE_MS（24h）的 instance 釋放（Redis 狀態仍在，重建便宜）。

import { PolarisPipeline, getPolarisPipeline, type PipelineOptions } from './pipeline.js';
import { findChannelById, type Channel } from '../data/channelRepo.js';
import { WorkerPool } from './workerPool.js';

export const IDLE_RECYCLE_MS = 24 * 60 * 60 * 1000;

export interface AgentInstance {
  channelId: string;
  channel: Channel;
  pipeline: PolarisPipeline;
  pool: WorkerPool;
  lastActiveAt: number;
}

export class AgentRegistry {
  private readonly instances = new Map<string, AgentInstance>();

  async get(channelId: string): Promise<AgentInstance> {
    const existing = this.instances.get(channelId);
    if (existing) {
      existing.lastActiveAt = Date.now();
      return existing;
    }

    const channel = await findChannelById(channelId);
    if (!channel) throw new Error(`channel not found: ${channelId}`);

    const opts: PipelineOptions = {};
    const pipeline = getPolarisPipeline(opts);
    const pool = new WorkerPool(async () => {}, 4); // handler 由 webhook 層註冊

    const instance: AgentInstance = {
      channelId,
      channel,
      pipeline,
      pool,
      lastActiveAt: Date.now(),
    };
    this.instances.set(channelId, instance);
    return instance;
  }

  /** admin 更新 channel 設定後呼叫，下次訊息自動重建 */
  invalidate(channelId: string): void {
    const inst = this.instances.get(channelId);
    if (inst) {
      inst.pool.removeQueue(channelId);
      this.instances.delete(channelId);
    }
  }

  /** 回收閒置 instance（可定時呼叫） */
  recycle(): void {
    const now = Date.now();
    for (const [channelId, inst] of this.instances) {
      if (now - inst.lastActiveAt > IDLE_RECYCLE_MS) {
        inst.pool.removeQueue(channelId);
        this.instances.delete(channelId);
      }
    }
  }

  get size(): number {
    return this.instances.size;
  }
}

let _registry: AgentRegistry | null = null;

export function getAgentRegistry(): AgentRegistry {
  if (!_registry) _registry = new AgentRegistry();
  return _registry;
}

export function resetAgentRegistry(): void {
  _registry = null;
}
