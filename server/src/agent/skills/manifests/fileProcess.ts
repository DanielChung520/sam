// Built-in skill: file-process
// 檔案（PDF / Word / Excel）下載、解析摘要與儲存
// 目前為降級回應：安裝 pdf-parse / mammoth 等依賴後接解析

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import type { HandleMessageInput } from '../../agent.js';

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const input = args as unknown as { media?: HandleMessageInput['media'] };
  const media = input.media;
  const fileName = media?.fileName ?? '未命名';
  if (media?.storageKey) {
    return {
      ok: true,
      output: `已收到您的檔案「${fileName}」並儲存完成 📎\n\n檔案解析功能即將開放 — 之後會自動提取 PDF / Word 內容並產生摘要。`,
    };
  }
  return {
    ok: true,
    output: `已收到您的檔案「${fileName}」📎 檔案解析功能即將開放，之後就能自動摘要 PDF / Word 內容。`,
  };
};

registerInlineHandler('file-process', handler);

const manifest: SkillManifest = {
  id: 'file-process',
  name: '檔案處理',
  description: '非圖片/語音檔案（PDF、Excel、Word）解析摘要與儲存',
  triggers: ['file', '檔案', 'pdf', 'word'],
  parameters: [
    { name: 'mediaType', type: 'string', required: true, description: 'file' },
    { name: 'fileName', type: 'string', required: false, description: '原始檔名' },
    { name: 'storageKey', type: 'string', required: false, description: '已儲存的檔案路徑' },
  ],
  executor: { type: 'inline', handler: 'file-process' },
  timeoutMs: 60_000,
};

export default manifest;
