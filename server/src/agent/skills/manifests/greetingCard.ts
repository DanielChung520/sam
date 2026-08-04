// Built-in skill: greeting-card
// 賀卡/問安卡個人化祝賀 — 委派給 process flow「回應祝賀及問安」（DB 配置 prompt）。
// 讓業務員在 FlowEditor 改 systemPrompt 真的生效。

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import { isGreetingType } from '../../greetingService.js';

const FLOW_ID = '回應祝賀及問安';

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
    // 委派給 process flow（DB skill_flows 集合「回應祝賀及問安」）
    // 流程圖的 llm 節點 systemPrompt 由業務員在 FlowEditor 配置
    const { runFlow } = await import('../../flowRunner.js');
    const flowResult = await runFlow({
      flowId: FLOW_ID,
      args: {
        type,
        festival: input.festival,
        greeting_period: input.greeting_period,
        greeting_content: input.greeting_content,
        summary: input.summary,
        imageUri: input.media?.receivedAt ? `media/${input.channelId}/test` : undefined,
        timestamp: Date.now(),
        userAccount: input.userId,
        channelId: input.channelId,
        businessOwnerId: input.channelId,
        source: 'LINE 圖片',
      },
    });
    if (flowResult.ok && flowResult.output) {
      return { ok: true, output: flowResult.output };
    }
    return { ok: true, output: `已收到您的祝福卡片，誠心感謝！${flowResult.error ? `（${flowResult.error}）` : ''}` };
  } catch (e) {
    console.warn('[greeting-card] failed:', e);
    return { ok: true, output: '已收到您的祝福卡片，誠心感謝！' };
  }
};

registerInlineHandler('greeting-card', handler);

const manifest: SkillManifest = {
  id: 'greeting-card',
  name: '賀卡祝賀',
  description: '依收卡人稱呼/性別/年齡段生成個人化文雅祝賀回覆（委派 process flow）',
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
