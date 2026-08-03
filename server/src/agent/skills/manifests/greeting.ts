// Built-in skill: greeting
// 身分詢問（你是誰）→ 自我介紹；純問候（你好）→ LLM 愉快回問候

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import { buildSelfIntro } from '../../selfIntro.js';
import { detectSelfIntro } from '../../intentClassifier.js';
import { chatCompletion } from '../../llmClient.js';

const FALLBACK_GREETINGS = [
  '您好！很高興見到您 😊 有什麼我可以幫您的嗎？',
  '嗨～您好呀！隨時聽候吩咐 🙌',
  '您好您好！需要我幫您轉告或提醒什麼嗎？',
];

async function getChannelName(channelId: string): Promise<string | undefined> {
  try {
    const { findChannelById } = await import('../../../data/channelRepo.js');
    const channel = await findChannelById(channelId);
    return channel?.name;
  } catch {
    return undefined;
  }
}

async function llmGreeting(userText: string, name: string): Promise<string> {
  const displayName = name || 'AI 助理';
  const res = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: `你是「${displayName}」的 LINE 分身助理。使用者正在向你打招呼。請用溫暖、愉快、簡短（1-2 句）的中文回覆問候，並表達樂意為他服務。不要自我介紹，只要回問候即可。`,
      },
      { role: 'user', content: userText },
    ],
    temperature: 0.8,
    maxTokens: 120,
    timeoutMs: 10_000,
  });
  const text = res.content.trim();
  if (!text) throw new Error('empty greeting response');
  return text;
}

const handler = async (
  _args: Record<string, unknown>,
  conversation: { channelId: string; history?: Array<{ role: string; content: string }> },
): Promise<{ ok: boolean; output: string }> => {
  const lastUserMsg = [...(conversation.history ?? [])].reverse().find((m) => m.role === 'user');
  const userText = lastUserMsg?.content ?? '';
  const name = await getChannelName(conversation.channelId);

  if (detectSelfIntro(userText)) {
    return { ok: true, output: buildSelfIntro(name) };
  }

  try {
    const reply = await llmGreeting(userText, name ?? '');
    return { ok: true, output: reply };
  } catch {
    const fallback = FALLBACK_GREETINGS[Math.floor(Math.random() * FALLBACK_GREETINGS.length)];
    return { ok: true, output: fallback };
  }
};

registerInlineHandler('greeting', handler);

const manifest: SkillManifest = {
  id: 'greeting',
  name: '打招呼',
  description: '回應使用者招呼、寒暄（LLM 回問候），並對身分詢問自我介紹',
  triggers: ['greeting', '自我介紹', '你是誰', '你是', 'who are you'],
  parameters: [],
  executor: { type: 'inline', handler: 'greeting' },
  timeoutMs: 15_000,
};

export default manifest;
