// Slash-command router for LINE webhook messages.
//
// Supported commands (case-insensitive):
//   /search <query>     -> run a "collect" sub-agent (web search + LLM summary)
//   /analysis <topic>   -> run collect + analyze sub-agents
//   /write <topic>      -> run a full plan (collect -> analyze -> outline -> write -> review -> assemble)
//   /help               -> list available commands
//
// Each command creates a taskforge plan, executes it asynchronously, polls
// until completion, then replies to the user on LINE with a digest of the
// result.

import { messagingApi } from '@line/bot-sdk';
import {
  createPlan,
  executePlan,
  waitForPlan,
  type TaskforgePlan,
  type TaskforgeTask,
} from '../lib/taskforge.js';

export interface SlashCommandResult {
  replyText: string;
  planId?: string;
  status?: string;
}

interface ParsedCommand {
  command: string;
  arg: string;
}

export function parseSlashCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const match = trimmed.match(/^\/([a-zA-Z]+)\s*([\s\S]*)$/);
  if (!match) return null;
  return { command: match[1].toLowerCase(), arg: match[2].trim() };
}

function buildTasksForCommand(command: string, arg: string, nowIso: string): TaskforgeTask[] {
  const tasks: TaskforgeTask[] = [];
  if (command === 'search') {
    tasks.push({
      id: 'T1',
      type: 'collect',
      title: '資料收集',
      description: arg,
      depends_on: [],
    });
    return tasks;
  }
  if (command === 'analysis' || command === 'analyze') {
    tasks.push({
      id: 'T1',
      type: 'collect',
      title: '資料收集',
      description: arg,
      depends_on: [],
    });
    tasks.push({
      id: 'T2',
      type: 'analyze',
      title: '深度分析',
      description: '分析收集到的資料，萃取關鍵洞察、趨勢與論點',
      depends_on: ['T1'],
    });
    return tasks;
  }
  if (command === 'write') {
    tasks.push(
      { id: 'T1', type: 'collect', title: '資料收集', description: arg, depends_on: [] },
      {
        id: 'T2',
        type: 'analyze',
        title: '深度分析',
        description: '分析收集到的資料，萃取關鍵洞察、趨勢與論點',
        depends_on: ['T1'],
      },
      {
        id: 'T3',
        type: 'outline',
        title: '建立大綱',
        description: '根據分析產出文章大綱與章節結構',
        depends_on: ['T2'],
      },
      {
        id: 'T4',
        type: 'write',
        title: '撰寫文件',
        description: '根據大綱撰寫完整文件',
        depends_on: ['T3'],
      },
      {
        id: 'T5',
        type: 'review',
        title: '品質檢查',
        description: '檢查全文一致性、完整性與品質',
        depends_on: ['T4'],
      },
      {
        id: 'T6',
        type: 'assemble',
        title: '組裝全文',
        description: '將所有章節合併為完整文件',
        depends_on: ['T5'],
      },
    );
    return tasks;
  }
  return tasks;
}

const HELP_TEXT = `可用指令：
/search <關鍵字>    搜尋網路資料（collect sub-agent）
/analysis <主題>    資料收集 + 深度分析（collect + analyze）
/write <主題>       完整寫作流程（collect → analyze → outline → write → review → assemble）
/help               顯示此說明`;

const UNKNOWN_TEXT = (cmd: string) =>
  `未知指令：/${cmd}\n輸入 /help 查看可用指令。`;

const MISSING_ARG_TEXT = (cmd: string) =>
  `請提供參數。用法：/${cmd} <主題或關鍵字>`;

function summarizePlan(plan: TaskforgePlan): string {
  if (plan.status === 'failed') {
    return `任務失敗 (${plan.id})：${plan.error ?? 'unknown error'}`;
  }
  const goal = plan.goal ?? '';
  const output = plan.output ?? '';
  const header = `✅ 完成：${goal}\n任務數：${plan.tasks.length}`;
  if (!output) return header;
  // LINE message limit is 5000 chars; truncate to 4500 to be safe.
  const trimmed = output.length > 4500 ? output.slice(0, 4500) + '\n\n…（已截斷）' : output;
  return `${header}\n\n${trimmed}`;
}

export async function handleSlashCommand(text: string): Promise<SlashCommandResult> {
  const parsed = parseSlashCommand(text);
  if (!parsed) {
    return { replyText: '請輸入有效指令。輸入 /help 查看可用指令。' };
  }

  const { command, arg } = parsed;

  if (command === 'help') return { replyText: HELP_TEXT };

  if (!arg) return { replyText: MISSING_ARG_TEXT(command) };

  if (command !== 'search' && command !== 'analysis' && command !== 'analyze' && command !== 'write') {
    return { replyText: UNKNOWN_TEXT(command) };
  }

  const tasks = buildTasksForCommand(command, arg, new Date().toISOString());
  if (tasks.length === 0) return { replyText: UNKNOWN_TEXT(command) };

  const created = await createPlan(arg, '', tasks);
  await executePlan(created.plan_id);
  const plan = await waitForPlan(created.plan_id, { timeoutMs: 6 * 60 * 1000 });

  return {
    replyText: summarizePlan(plan),
    planId: created.plan_id,
    status: plan.status,
  };
}

// Reply to a LINE user with text. Splits long messages at LINE's 5000-char limit.
export async function replyToLine(
  client: messagingApi.MessagingApiClient,
  replyToken: string,
  text: string,
): Promise<void> {
  const MAX = 4500;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += MAX) chunks.push(text.slice(i, i + MAX));
  const messages = chunks.map((c) => ({ type: 'text' as const, text: c }));
  await client.replyMessage({ replyToken, messages });
}