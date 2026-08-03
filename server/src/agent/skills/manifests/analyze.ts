// Built-in skill: analyze
// 透過 taskforge 執行 collect + analyze
// 注意：description 是給 LLM 的自然語言 prompt，使用 ${topic} 模板

import type { SkillManifest } from '../../types.js';

const manifest: SkillManifest = {
  id: 'analyze',
  name: '深度分析',
  description: '收集資料並進行深度分析，萃取關鍵洞察',
  triggers: ['analyze', 'analysis', '分析', '研究'],
  parameters: [
    { name: 'topic', type: 'string', required: true, description: '分析主題' },
  ],
  executor: {
    type: 'taskforge',
    tasks: [
      {
        id: 'T1',
        type: 'collect',
        title: '蒐集「${topic}」的相關資料',
        description:
          '請蒐集「${topic}」的相關背景資料、現況與重要觀點。\n' +
          '整理成結構化筆記（key facts + 不同立場），控制在 800 字以內。',
      },
      {
        id: 'T2',
        type: 'analyze',
        title: '深度分析「${topic}」',
        description:
          '基於上一階段收集的資料，請對「${topic}」進行深度分析。\n' +
          '輸出格式：\n' +
          '## 核心洞察\n' +
          '- （3-5 點，每點附證據）\n\n' +
          '## 趨勢與發展\n' +
          '- （短期/中期觀察）\n\n' +
          '## 行動建議\n' +
          '- （具體可行的下一步）\n\n' +
          '請用繁體中文，控制在 800 字以內。',
        depends_on: ['T1'],
      },
    ],
  },
  timeoutMs: 180_000,
};

export default manifest;