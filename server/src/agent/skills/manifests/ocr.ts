// Built-in skill: ocr
// 圖片文字辨識（名片 / 賀卡 / 其他）— 呼叫本機 Qwen2.5-VL vllm 引擎

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import { getFileStorage } from '../../../lib/fileStorage.js';
import { logger } from '../../logger.js';

const VL_ENDPOINT = process.env.VL_API_BASE ?? 'http://127.0.0.1:18002/v1';
const VL_MODEL = process.env.VL_MODEL ?? 'Qwen2.5-VL-7B-Instruct';

async function recognizeImage(imageB64: string): Promise<string> {
  const res = await fetch(`${VL_ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VL_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageB64}` } },
            {
              type: 'text',
              text:
                '請辨識這張圖片中的所有文字並說明圖片內容。若為名片：輸出姓名、公司、職稱、電話、email、地址。若為賀卡：輸出祝賀文字。其他圖片：摘要內容。用繁體中文回答，條列分明。',
            },
          ],
        },
      ],
      max_tokens: 600,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`VL engine HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const j = (await res.json()) as any;
  return j?.choices?.[0]?.message?.content ?? '';
}

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const input = args as unknown as { media?: { storageKey?: string; fileName?: string } };
  const media = input.media;

  if (!media?.storageKey) {
    return { ok: true, output: '收到您的圖片 📷 正在辨識...' };
  }

  try {
    const storage = getFileStorage();
    const { body } = await storage.get(media.storageKey);
    const imageB64 = body.toString('base64');
    const text = await recognizeImage(imageB64);
    if (!text.trim()) throw new Error('empty recognition result');
    return { ok: true, output: `📷 圖片辨識結果：\n\n${text.trim()}` };
  } catch (e) {
    logger.warn('ocr.recognize_failed', { storageKey: media.storageKey, error: String(e) });
    return {
      ok: true,
      output: `已收到您的圖片並儲存完成 📷\n\n圖片辨識暫時無法處理（引擎忙碌），稍後再試。`,
    };
  }
};

registerInlineHandler('ocr', handler);

const manifest: SkillManifest = {
  id: 'ocr',
  name: 'OCR 解析',
  description: '圖片文字辨識：名片 / 賀卡 / 其他圖片分類與結構化輸出',
  triggers: ['image', 'ocr', '辨識圖片'],
  parameters: [
    { name: 'mediaType', type: 'string', required: true, description: 'image' },
    { name: 'storageKey', type: 'string', required: false, description: '已儲存的圖片路徑' },
  ],
  executor: { type: 'inline', handler: 'ocr' },
  timeoutMs: 60_000,
};

export default manifest;
