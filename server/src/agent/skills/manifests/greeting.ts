// Built-in skill: greeting
// 回應使用者招呼 / 「你是誰」 — 自我介紹 + 問候 + `/` 提示

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import { buildSelfIntro } from '../../selfIntro.js';

const handler = async (
  _args: Record<string, unknown>,
  conversation: { channelId: string },
): Promise<{ ok: boolean; output: string }> => {
  let name: string | undefined;
  try {
    const { findChannelById } = await import('../../../data/channelRepo.js');
    const channel = await findChannelById(conversation.channelId);
    name = channel?.name;
  } catch {
    /* channel 查詢失敗仍回自我介紹 */
  }
  return { ok: true, output: buildSelfIntro(name) };
};

registerInlineHandler('greeting', handler);

const manifest: SkillManifest = {
  id: 'greeting',
  name: '打招呼',
  description: '回應使用者招呼、寒暄，並自我介紹與提示 / 工作清單',
  triggers: ['greeting', '自我介紹', '你是誰', '你是', 'who are you'],
  parameters: [],
  executor: { type: 'inline', handler: 'greeting' },
  timeoutMs: 5_000,
};

export default manifest;
