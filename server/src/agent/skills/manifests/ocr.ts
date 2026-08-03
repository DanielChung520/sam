// Built-in skill: ocr
// 圖片解析：名片 / 問安卡 / 祝福賀卡 / 其他 — 透過 dllm VL 模型輸出結構化 JSON

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler, getSkillExecutor } from '../../skillExecutor.js';
import { getSkillRegistry } from '../../skillRegistry.js';
import { getFileStorage } from '../../../lib/fileStorage.js';
import { logger } from '../../logger.js';
import { isGreetingType, generateGreetingReply } from '../../greetingService.js';

const DLLM_API_BASE = process.env.LLM_API_BASE ?? 'http://localhost:11400/v1';
const DLLM_API_KEY = process.env.LLM_API_KEY ?? '';
const VL_MODEL = process.env.VL_MODEL ?? 'Qwen2.5-VL-7B-Instruct';

const OCR_PROMPT = `請解析這張圖片，嚴格輸出 JSON（不要 markdown 包裹、不要額外文字），格式如下：

{
  "summary": "圖片概述：一段話描述圖片整體內容",
  "type": "名片 | 問安卡 | 祝福賀卡 | 其他",
  "name": "姓名（若為名片）",
  "title": "職稱（若為名片）",
  "company": "公司（若為名片）",
  "phone": "聯繫電話（若為名片）",
  "email": "email（若為名片）",
  "other_contacts": { "qq": "", "line": "", "wechat": "", "其他": "" },
  "greeting_period": "問安時段：清晨/上午/中午/下午/傍晚/晚上/深夜（若為問安卡）",
  "festival": "節慶名稱（若為節慶賀卡，如 中秋節/新年/生日/母親節）",
  "greeting_content": "問候或祝福內容原文（若為問安/賀卡）",
  "text": "掃描到的全部文字（其他圖片用，逐行列出）"
}

規則：
1. type 四選一：名片 / 問安卡 / 祝福賀卡 / 其他
2. 名片：特別檢查「名字」（理論上是圖中最大字），與職稱、公司、電話、email、qq、line、微信等聯繫方式
3. 問安卡：區分時段（早/中/午/晚），輸出問候內容
4. 祝福賀卡：判斷節慶（如過年、中秋、生日、母親節），輸出祝福內容
5. 其他：掃描所有文字，逐行列出
6. 每個項目都有對應欄位就填，沒有就留空字串
7. 全部用繁體中文`;

async function recognizeImage(imageB64: string): Promise<string> {
  const res = await fetch(`${DLLM_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(DLLM_API_KEY ? { Authorization: `Bearer ${DLLM_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: VL_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageB64}` } },
            { type: 'text', text: OCR_PROMPT },
          ],
        },
      ],
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`dllm VL HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const j = (await res.json()) as any;
  return j?.choices?.[0]?.message?.content ?? '';
}

// 依 type 產生給 LINE 的回覆（人讀，非原始 JSON）
function formatReply(parsed: any, receivedAt?: number): string {
  const type = parsed.type ?? '其他';
  const timeStr = receivedAt ? new Date(receivedAt).toLocaleString('zh-TW', { hour12: false }) : '';
  const lines: string[] = [`📷 圖片解析（${type}）`];
  if (timeStr) lines.push(`⏱ ${timeStr}`);

  if (parsed.summary) lines.push(`\n📝 ${parsed.summary}`);

  if (type === '名片') {
    if (parsed.name) lines.push(`\n👤 姓名：${parsed.name}`);
    if (parsed.title) lines.push(`💼 職稱：${parsed.title}`);
    if (parsed.company) lines.push(`🏢 公司：${parsed.company}`);
    if (parsed.phone) lines.push(`📞 電話：${parsed.phone}`);
    if (parsed.email) lines.push(`📧 Email：${parsed.email}`);
    const oc = parsed.other_contacts ?? {};
    const extras = Object.entries(oc).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' / ');
    if (extras) lines.push(`🔗 其他：${extras}`);
  }

  if (type === '問安卡' || type === '祝福賀卡') {
    if (parsed.greeting_period) lines.push(`\n🕐 時段：${parsed.greeting_period}`);
    if (parsed.festival) lines.push(`🎉 節慶：${parsed.festival}`);
    if (parsed.greeting_content) lines.push(`\n💬 ${parsed.greeting_content}`);
  }

  if (type === '其他' && parsed.text) {
    lines.push(`\n📄 掃描文字：\n${parsed.text}`);
  }

  return lines.join('\n');
}

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const input = args as unknown as {
    media?: { storageKey?: string; fileName?: string; receivedAt?: number };
    receivedAt?: number;
  };
  const media = input.media;
  const receivedAt = typeof input.receivedAt === 'number'
    ? input.receivedAt
    : typeof media?.receivedAt === 'number' ? media.receivedAt : undefined;

  if (!media?.storageKey) {
    return { ok: true, output: '收到您的圖片 📷 正在辨識...' };
  }

  try {
    const storage = getFileStorage();
    const { body } = await storage.get(media.storageKey);
    const imageB64 = body.toString('base64');
    const text = await recognizeImage(imageB64);
    if (!text.trim()) throw new Error('empty recognition result');

    // 解析 JSON（容錯：剝離 markdown 包裹）
    let parsed: any;
    try {
      const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, '');
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { type: '其他', summary: text.trim().slice(0, 200) };
    }

    const base = formatReply(parsed, receivedAt);
    const type = parsed.type ?? '';

    // 分流處理：依 OCR 分類
    if (isGreetingType(type)) {
      // 問安卡 / 祝福賀卡 → 祝賀回覆
      try {
        const reply = await generateGreetingReply(parsed);
        if (reply) {
          return { ok: true, output: `${reply}\n\n${base}` };
        }
      } catch (e) {
        logger.warn('ocr.greeting_generation_failed', { storageKey: media.storageKey, error: String(e) });
      }
    } else if (type.includes('名片')) {
      // 名片 → 名片收集與回應 skill（感謝回覆）
      try {
        const reg = await getSkillRegistry();
        const cardSkill = reg.get('card-collection');
        if (cardSkill) {
          const conv = { id: `card_${media.storageKey ?? Date.now()}`, userId: 'u', channelId: 'c', state: 'idle' as const, history: [], context: {}, createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 1000 };
          const cardResult = await getSkillExecutor().execute(cardSkill, parsed, conv as any);
          if (cardResult.ok && cardResult.output) {
            return { ok: true, output: `${cardResult.output}\n\n${base}` };
          }
        }
      } catch (e) {
        logger.warn('ocr.card_fallback', { storageKey: media.storageKey, error: String(e) });
      }
    }

    return { ok: true, output: base };
  } catch (e) {
    logger.warn('ocr.recognize_failed', { storageKey: media.storageKey, error: String(e) });
    return {
      ok: true,
      output: `已收到您的圖片並儲存完成 📷\n\n圖片解析暫時無法處理（引擎忙碌），稍後再試。`,
    };
  }
};

registerInlineHandler('ocr', handler);

const manifest: SkillManifest = {
  id: 'ocr',
  name: 'OCR 解析',
  description: '圖片解析：名片 / 問安卡 / 祝福賀卡 / 其他，結構化 JSON 輸出',
  triggers: ['image', 'ocr', '辨識圖片'],
  parameters: [
    { name: 'mediaType', type: 'string', required: true, description: 'image' },
    { name: 'storageKey', type: 'string', required: false, description: '已儲存的圖片路徑' },
    { name: 'receivedAt', type: 'number', required: false, description: '接收時間戳（epoch ms）' },
  ],
  executor: { type: 'inline', handler: 'ocr' },
  timeoutMs: 120_000,
};

export default manifest;
