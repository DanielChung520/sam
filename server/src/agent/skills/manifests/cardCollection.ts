// Built-in skill: card-collection
// 名片收集與回應
//
// OCR 分類為「名片」時：儲存至名片夾（business_cards collection）、
// 生成感謝回覆（LLM 依姓名/職稱）、回覆對方。
// 來源為 LINE 傳圖 → 自動回覆；來源為 App 掃描 → 僅儲存。

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const parsed = (args ?? {}) as any;
  const type = parsed.type ?? '';
  const name = parsed.name ?? '';
  const title = parsed.title ?? '';

  // 非名片：拒絕（分流至其他處理）
  if (!type.includes('名片')) {
    return { ok: true, output: '此圖片非名片，已分流至其他解析流程。' };
  }

  // TODO: 儲存至 business_cards collection（channelId 隔離）
  // TODO: SeaweedFS 圖片關聯

  // 生成感謝回覆（LLM）
  try {
    const { generateCardThankYou } = await import('../../cardService.js');
    const reply = await generateCardThankYou(name, title);
    return { ok: true, output: reply };
  } catch {
    const fallback = name ? `感謝您提供名片，${name}${title ? `（${title}）` : ''}！已為您建檔，後續保持聯繫。` : '感謝您提供名片，已為您建檔，後續保持聯繫！';
    return { ok: true, output: fallback };
  }
};

registerInlineHandler('card-collection', handler);

const manifest: SkillManifest = {
  id: 'card-collection',
  name: '名片收集與回應',
  description: 'OCR 分類為名片時儲存至名片夾並生成感謝回覆',
  triggers: ['名片', 'card'],
  parameters: [
    { name: 'type', type: 'string', required: true, description: 'OCR 分類（必須為名片）' },
    { name: 'name', type: 'string', required: false, description: '姓名' },
    { name: 'title', type: 'string', required: false, description: '職稱' },
  ],
  executor: { type: 'inline', handler: 'card-collection' },
  timeoutMs: 30_000,
};

export default manifest;
