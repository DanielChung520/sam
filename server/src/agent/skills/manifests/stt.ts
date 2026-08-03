// Built-in skill: stt
// 語音 / 影片訊息轉文字
// 目前為降級回應：ASR 模型/服務就緒後接轉錄

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import type { HandleMessageInput } from '../../agent.js';

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const input = args as unknown as { media?: HandleMessageInput['media'] };
  const media = input.media;
  if (media?.storageKey) {
    return {
      ok: true,
      output: `已收到您的語音訊息並儲存完成 🎤\n\n語音轉文字功能即將開放 — 之後會自動把語音轉成文字並理解您的需求。`,
    };
  }
  return {
    ok: true,
    output: `已收到您的語音訊息 🎤 語音轉文字功能即將開放，之後就能直接理解您的語音內容。`,
  };
};

registerInlineHandler('stt', handler);

const manifest: SkillManifest = {
  id: 'stt',
  name: '語音轉文字（STT）',
  description: '語音訊息自動轉文字，接續 LLM 處理或特定指令',
  triggers: ['audio', '語音', 'voice'],
  parameters: [
    { name: 'mediaType', type: 'string', required: true, description: 'audio | video' },
    { name: 'storageKey', type: 'string', required: false, description: '已儲存的語音路徑' },
  ],
  executor: { type: 'inline', handler: 'stt' },
  timeoutMs: 30_000,
};

export default manifest;
