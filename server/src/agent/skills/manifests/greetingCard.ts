// Built-in skill: greeting-card
// 節日祝賀 / 問安圖片偵測 → 回覆對應祝福語
// 目前為降級回應：OCR 就緒後接賀卡分類

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';

const handler = async (): Promise<{ ok: boolean; output: string }> => {
  return {
    ok: true,
    output: `已收到您的節日賀卡！🎉 祝福語自動回覆功能即將開放，之後就會依節日自動回覆對應的問候。`,
  };
};

registerInlineHandler('greeting-card', handler);

const manifest: SkillManifest = {
  id: 'greeting-card',
  name: '回應祝賀及問安',
  description: '偵測節日祝賀、問安圖片，自動回覆對應祝福語',
  triggers: ['greeting', '賀卡', '問安', '祝賀'],
  parameters: [],
  executor: { type: 'inline', handler: 'greeting-card' },
  timeoutMs: 5_000,
};

export default manifest;
