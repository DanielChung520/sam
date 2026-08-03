// Built-in skill: greeting
// 簡單 inline handler，回應使用者招呼

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';

const handler = async (): Promise<{ ok: boolean; output: string }> => {
  const greetings = [
    '你好！我是 sam 助手，有什麼可以幫你的嗎？',
    '哈囉～請問今天想了解什麼？',
    '您好，準備好開始工作了！',
    'Hi！想聊什麼都可以，我會盡力幫忙。',
  ];
  const pick = greetings[Math.floor(Math.random() * greetings.length)];
  return { ok: true, output: pick };
};

registerInlineHandler('greeting', handler);

const manifest: SkillManifest = {
  id: 'greeting',
  name: '打招呼',
  description: '回應使用者招呼、寒暄',
  triggers: ['greeting'],
  parameters: [],
  executor: { type: 'inline', handler: 'greeting' },
  timeoutMs: 5_000,
};

export default manifest;