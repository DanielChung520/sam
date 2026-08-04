// Built-in skill: image-router（圖片分流）
//
// script executor：vm sandbox 執行程式碼 — 呼叫 ocr skill（parseOnly 回結構化 JSON），
// 依 type 分流：名片 → card-collection、賀卡 → greeting-card、其他 → 摘要回覆。
// 意圖規則：messageType=image → behavior.action=skill, target=image-router。

import type { SkillManifest } from '../../types.js';

const IMAGE_ROUTER_CODE = `
// image-router：OCR(parseOnly) → 依 type 分流（名片/賀卡/其他）
const ocr = await callSkill('ocr', { ...args, parseOnly: true });
const parsed = JSON.parse(String(ocr.output ?? '{}'));
const type = String(parsed.type ?? '其他');
if (type.includes('名片')) {
  const card = await callSkill('card-collection', { ...args, ...parsed });
  return String(card.output ?? '');
}
if (type.includes('問安') || type.includes('祝福')) {
  const greet = await callSkill('greeting-card', { ...args, ...parsed });
  return String(greet.output ?? '');
}
return parsed.summary ? '📷 圖片解析（其他）\\n📝 ' + String(parsed.summary) : '📷 圖片解析（其他）';
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
