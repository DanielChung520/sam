// Built-in skill: image-router（圖片分流）
//
// script executor：vm sandbox 執行程式碼 — 呼叫 ocr skill 解析，
// 依結果分流：名片 → card-collection（感謝回覆）、其他 → 回覆 OCR 結果。
// 意圖規則：messageType=image → behavior.action=skill, target=image-router。

import type { SkillManifest } from '../../types.js';

const IMAGE_ROUTER_CODE = `
// image-router：OCR → 依結果分流
const ocr = await callSkill('ocr', args);
const out = String(ocr.output ?? '');
log('OCR type:', out.includes('名片') ? '名片' : '其他');
if (out.includes('名片')) {
  const card = await callSkill('card-collection', { ...args, type: '名片' });
  return String(card.output ?? '');
}
return out;
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
