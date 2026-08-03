// Built-in skill: write
// 透過 taskforge 跑完整寫作 pipeline
// 注意：description 是給 LLM 的自然語言 prompt，使用 ${topic} 模板

import type { SkillManifest } from '../../types.js';

const manifest: SkillManifest = {
  id: 'write',
  name: '完整寫作',
  description: '完整寫作流程：收集 → 分析 → 大綱 → 撰寫 → 檢查 → 組裝',
  triggers: ['write', 'article', 'draft', '寫', '撰寫', '文章'],
  parameters: [
    { name: 'topic', type: 'string', required: true, description: '寫作主題' },
  ],
  executor: {
    type: 'taskforge',
    tasks: [
      {
        id: 'T1',
        type: 'collect',
        title: '蒐集「${topic}」的寫作資料',
        description:
          '請蒐集與「${topic}」相關的事實、數據、案例與不同觀點，作為寫作素材。\n' +
          '整理成條列式筆記，控制在 600 字以內。',
      },
      {
        id: 'T2',
        type: 'analyze',
        title: '分析「${topic}」的切入角度',
        description:
          '基於上一階段的素材，請找出 3-5 個值得深入論述的切入角度。\n' +
          '為每個角度列出核心論點與可用證據。',
        depends_on: ['T1'],
      },
      {
        id: 'T3',
        type: 'outline',
        title: '為「${topic}」擬定文章大綱',
        description:
          '請根據分析結果，產出完整的文章大綱。\n' +
          '結構：\n' +
          '# 標題\n' +
          '## 一、前言（切入主題）\n' +
          '## 二、核心論述（3-4 個小節）\n' +
          '## 三、實務應用 / 案例\n' +
          '## 四、結論與展望',
        depends_on: ['T2'],
      },
      {
        id: 'T4',
        type: 'write',
        title: '撰寫「${topic}」完整文章',
        description:
          '請根據大綱撰寫完整文章。\n' +
          '要求：\n' +
          '- 繁體中文，1500-2500 字\n' +
          '- 用第二人稱或第三人稱，避免論文式口吻\n' +
          '- 段落分明，每段 3-5 句\n' +
          '- 適當使用小標題與列點',
        depends_on: ['T3'],
      },
      {
        id: 'T5',
        type: 'review',
        title: '品質檢查',
        description:
          '請檢查上一階段撰寫的文章：\n' +
          '1. 邏輯是否連貫\n' +
          '2. 是否回應主題\n' +
          '3. 用詞是否一致\n' +
          '4. 是否有事實錯誤\n\n' +
          '若有問題請列出修改建議；沒問題就回「品質良好，無需修改」。',
        depends_on: ['T4'],
      },
      {
        id: 'T6',
        type: 'assemble',
        title: '組裝最終文章',
        description:
          '請將所有章節組合成一篇完整的、可直接發佈的文章。\n' +
          '加上適當的標題層級與分隔線。最終輸出即為成品。',
        depends_on: ['T5'],
      },
    ],
  },
  timeoutMs: 300_000,
};

export default manifest;