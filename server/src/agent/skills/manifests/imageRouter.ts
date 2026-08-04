// Built-in skill: image-router（圖片分流）
//
// process executor：跑 skill_flows 的 image-router 流程（OCR → 依 type 分流到名片/賀卡/其他）。
// 意圖規則：messageType=image → behavior.action=skill, target=image-router。

import type { SkillManifest } from '../../types.js';

const manifest: SkillManifest = {
  id: 'image-router',
  name: '圖片分流',
  description: '收到圖片後依 OCR 結果分流：名片 → 名片收集、賀卡 → 問候祝福、其他 → 摘要回覆',
  triggers: ['image', '圖片'],
  parameters: [
    { name: 'media', type: 'entity', required: true, description: 'LINE media payload（storageKey/mediaType/messageId）' },
  ],
  executor: { type: 'process', flowId: 'image-router' },
  timeoutMs: 120_000,
};

export default manifest;
