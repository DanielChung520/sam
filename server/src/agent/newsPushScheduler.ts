// News push scheduler — 發送好友批次排程
//
// 與 newsScheduler 同模式：setTimeout 鏈（非 setInterval）避免疊跑。
// 每 30 秒掃一次到期任務（pending/sending 且 nextBatchAt <= now），逐批發送。
// 任務本身 DB 持久化，server 重啟後由 DB 狀態恢復，不會中斷未送完的批次。

import { listDueNewsPushTasks } from '../data/newsPushRepo.js';
import { processNewsPushBatch } from './newsService.js';
import { logger } from './logger.js';

const CHECK_INTERVAL_MS = 30_000;

let timer: NodeJS.Timeout | null = null;

export function startNewsPushScheduler(): void {
  if (timer) return;
  logger.info('news.push.scheduler.started', { checkIntervalMs: CHECK_INTERVAL_MS });
  timer = setTimeout(tick, 3_000);
}

export function stopNewsPushScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

async function tick(): Promise<void> {
  try {
    const due = await listDueNewsPushTasks();
    for (const task of due) {
      await processNewsPushBatch(task).catch((e) =>
        logger.error('news.push.scheduler.task_failed', {
          taskId: task._key,
          error: String(e),
        })
      );
    }
  } catch (e) {
    logger.warn('news.push.scheduler.tick_failed', { error: String(e) });
  } finally {
    timer = setTimeout(tick, CHECK_INTERVAL_MS);
  }
}
