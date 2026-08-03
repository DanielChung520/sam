// Built-in skill: ocr
// 圖片文字辨識 + 分類（名片 / 賀卡 / 其他）
// 目前為降級回應：環境（dllm VL 引擎）就緒後接 Qwen2.5-VL-7B-Instruct

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import type { HandleMessageInput } from '../../agent.js';

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const input = args as unknown as { media?: HandleMessageInput['media'] };
  const media = input.media;
  if (media?.storageKey) {
    return {
      ok: true,
      output: `已收到您的圖片並儲存完成 📷\n\n圖片辨識功能即將開放 — 之後會自動幫您分類名片、賀卡與其他圖片，並整理成結構化資訊。`,
    };
  }
  return {
    ok: true,
    output: `已收到您的圖片 📷 圖片辨識功能即將開放，之後就能自動幫您整理名片、賀卡與圖片內容。`,
  };
};

registerInlineHandler('ocr', handler);

const manifest: SkillManifest = {
  id: 'ocr',
  name: 'OCR 解析',
  description: '圖片文字辨識：名片 / 賀卡 / 其他圖片分類與結構化輸出',
  triggers: ['image', 'ocr', '辨識圖片'],
  parameters: [
    { name: 'mediaType', type: 'string', required: true, description: 'image' },
    { name: 'storageKey', type: 'string', required: false, description: '已儲存的圖片路徑' },
  ],
  executor: { type: 'inline', handler: 'ocr' },
  timeoutMs: 30_000,
};

export default manifest;
