// Built-in skill: greeting-card
// 賀卡/問安卡個人化祝賀 — 依收卡人稱呼/性別/年齡段生成文雅祝賀，含品質重試與通知主身。
// 由 image-router script 分流呼叫（ocr parseOnly → 依 type 判斷賀卡 → 呼叫本 skill）。

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import { generatePersonalizedGreeting, isGreetingType } from '../../greetingService.js';

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const input = args as unknown as {
    type?: string;
    festival?: string;
    greeting_period?: string;
    greeting_content?: string;
    summary?: string;
    channelId?: string;
    userId?: string;
    media?: { receivedAt?: number };
  };
  const type = input.type ?? '';

  if (!isGreetingType(type)) {
    return { ok: true, output: '此圖片非賀卡/問安卡，已分流至其他解析流程。' };
  }

  try {
    const { loadFlowConfig } = await import('../../skillConfig.js');
    const flowConfig = await loadFlowConfig('ocr');
    const result = await generatePersonalizedGreeting({
      type,
      festival: input.festival,
      greeting_period: input.greeting_period,
      greeting_content: input.greeting_content,
      summary: input.summary,
      channelId: input.channelId ?? 'unknown',
      userId: input.userId ?? 'unknown',
      modelConfig: {
        apiBase: (flowConfig.apiBase as string) ?? undefined,
        apiKey: (flowConfig.apiKey as string) ?? undefined,
        model: (flowConfig.model as string) ?? undefined,
      },
    });
    if (result.ok && result.reply) {
      return { ok: true, output: result.reply };
    }
    return { ok: true, output: `已收到您的祝福卡片，誠心感謝！${result.reason ? `（${result.reason}）` : ''}` };
  } catch (e) {
    console.warn('[greeting-card] failed:', e);
    return { ok: true, output: '已收到您的祝福卡片，誠心感謝！' };
  }
};

registerInlineHandler('greeting-card', handler);

const manifest: SkillManifest = {
  id: 'greeting-card',
  name: '賀卡祝賀',
  description: '依收卡人稱呼/性別/年齡段生成個人化文雅祝賀回覆',
  triggers: ['問安卡', '祝福賀卡', '賀卡'],
  parameters: [
    { name: 'type', type: 'string', required: true, description: 'OCR 分類（問安卡/祝福賀卡）' },
    { name: 'festival', type: 'string', required: false, description: '節慶名稱' },
    { name: 'channelId', type: 'string', required: true, description: 'channel 隔離' },
    { name: 'userId', type: 'string', required: true, description: '收卡人（用於查稱呼/性別/年齡段）' },
  ],
  executor: { type: 'inline', handler: 'greeting-card' },
  timeoutMs: 30_000,
};

export default manifest;
