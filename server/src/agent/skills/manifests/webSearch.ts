// Built-in skill: web-search
// 透過 taskforge 執行單一 collect task（web 搜尋 + LLM 摘要）
// 注意：description 是給 LLM 的自然語言 prompt，使用 ${query} 模板

import type { SkillManifest } from '../../types.js';

const manifest: SkillManifest = {
  id: 'web-search',
  name: '網路搜尋',
  description: '搜尋網路資料並整理成中文摘要',
  triggers: ['search', 'find', 'look up', '查詢', '搜尋', '找'],
  parameters: [
    { name: 'query', type: 'string', required: true, description: '搜尋關鍵字' },
  ],
  executor: {
    type: 'taskforge',
    tasks: [
      {
        id: 'T1',
        type: 'collect',
        title: '搜尋「${query}」的相關資料',
        description:
          '請搜尋並整理「${query}」的最新相關資料。\n' +
          '輸出格式：\n' +
          '1. 核心結論（3-5 點）\n' +
          '2. 重要細節與佐證\n' +
          '3. 來源/出處（若有）\n' +
          '請用繁體中文，控制在 500 字以內。',
      },
    ],
  },
  timeoutMs: 120_000,
};

export default manifest;