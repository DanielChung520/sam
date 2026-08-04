// Built-in skill: image-router（圖片分流）
//
// script executor：vm sandbox 執行程式碼 — 呼叫 ocr skill（parseOnly 回結構化 JSON），
// 依 type 分流：名片 → card-collection、賀卡 → greeting-card、其他 → 摘要回覆，並記錄各節點耗時。
// 意圖規則：messageType=image → behavior.action=skill, target=image-router。

import type { SkillManifest } from '../../types.js';

const IMAGE_ROUTER_CODE = `
// image-router：OCR(parseOnly) → 依 type 分流（名片/賀卡/其他），記錄各節點耗時
const t0 = Date.now();
const ocr = await callSkill('ocr', { ...args, parseOnly: true });
const t1 = Date.now();
const parsed = JSON.parse(String(ocr.output ?? '{}'));
const type = String(parsed.type ?? '其他');
const ocrMs = t1 - t0;
if (type.includes('名片')) {
  const card = await callSkill('card-collection', { ...args, ...parsed });
  const t2 = Date.now();
  return String(card.output ?? '') + '\\n\\n⏱ ocr:' + ocrMs + 'ms / card-collection:' + (t2 - t1) + 'ms / 總計:' + (t2 - t0) + 'ms';
}
if (type.includes('問安') || type.includes('祝福')) {
  const greet = await callSkill('greeting-card', { ...args, ...parsed });
  const t2 = Date.now();
  return String(greet.output ?? '') + '\\n\\n⏱ ocr:' + ocrMs + 'ms / greeting-card:' + (t2 - t1) + 'ms / 總計:' + (t2 - t0) + 'ms';
}
const t2 = Date.now();
const other = parsed.summary ? '📷 圖片解析（其他）\\n📝 ' + String(parsed.summary) : '📷 圖片解析（其他）';
return other + '\\n\\n⏱ ocr:' + ocrMs + 'ms / 總計:' + (t2 - t0) + 'ms';
`;

const manifest: SkillManifest = {
  id: 'image-router',
  name: '圖片分流',
  description: '收到圖片後依 OCR 結果分流：名片 → 名片收集、其他 → 摘要回覆',
  triggers: ['image', '圖片'],
  parameters: [
    { name: 'media', type: 'entity', required: true, description: 'LINE media payload（storageKey/mediaType/messageId）' },
  ],
  executor: { type: 'script', code: IMAGE_ROUTER_CODE },
  timeoutMs: 120_000,
};

export default manifest;
