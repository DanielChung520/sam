// Built-in skill: greeting-card
// 回應祝賀及問安
//
// 實際實作整合於 ocr skill：OCR 分類為「問安卡/祝福賀卡」時，
// 自動以 LLM 生成個人化祝賀/問安回覆（見 ocr.ts 的 generateGreetingReply）。
// 此 skill 保留為觸發詞路由（/greeting 等），避免 slash 指令無對應 skill。

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';

const handler = async (): Promise<{ ok: boolean; output: string }> => {
  return {
    ok: true,
    output: '祝賀與問安回覆已整合於圖片解析流程 — 收到賀卡/問安卡圖片時會自動回覆。',
  };
};

registerInlineHandler('greeting-card', handler);

const manifest: SkillManifest = {
  id: 'greeting-card',
  name: '回應祝賀及問安',
  description: '賀卡/問安圖片自動回覆祝福語（整合於 ocr skill 的 LLM 祝賀生成）',
  triggers: ['greeting', '賀卡', '問安', '祝賀'],
  parameters: [],
  executor: { type: 'inline', handler: 'greeting-card' },
  timeoutMs: 5_000,
};

export default manifest;
