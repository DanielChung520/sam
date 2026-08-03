// Built-in skill: slash-command
// 處理 /search, /analysis, /write, /help 等 slash command
// 保留舊 webhook 行為的向後相容

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';

const handler = async (
  args: Record<string, unknown>,
): Promise<{ ok: boolean; output: string }> => {
  const command = String(args.command ?? '').toLowerCase();
  const arg = String(args.arg ?? '').trim();

  if (command === 'help' || !command) {
    return {
      ok: true,
      output: `可用指令：
/search <關鍵字>    搜尋網路資料
/analysis <主題>    資料收集 + 深度分析
/write <主題>       完整寫作流程
/help               顯示此說明`,
    };
  }

  if (!arg) {
    return {
      ok: false,
      output: `請提供參數。用法：/${command} <主題或關鍵字>`,
    };
  }

  if (command !== 'search' && command !== 'analysis' && command !== 'analyze' && command !== 'write') {
    return {
      ok: false,
      output: `未知指令：/${command}\n輸入 /help 查看可用指令。`,
    };
  }

  // 真正的 taskforge 執行會由 skillExecutor 在 web-search/write skills 處理
  // 這裡只做 dispatch 預檢
  return {
    ok: true,
    output: `指令 /${command} ${arg} 已接收`,
  };
};

registerInlineHandler('slash-command', handler);

const manifest: SkillManifest = {
  id: 'slash-command',
  name: '斜線指令',
  description: '處理使用者斜線指令（/search, /analysis, /write, /help）',
  triggers: ['slash_command'],
  parameters: [
    { name: 'command', type: 'string', required: true, description: '指令名稱' },
    { name: 'arg', type: 'string', required: false, description: '指令參數' },
  ],
  executor: { type: 'inline', handler: 'slash-command' },
  timeoutMs: 5_000,
};

export default manifest;