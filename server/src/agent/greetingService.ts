// Greeting 祝賀/問安回覆服務
//
// 依 OCR 分類結果（問安卡 / 祝福賀卡）生成個人化祝賀回覆：
//   1. 找主身的朋友稱呼（title/nickname/honorific，fallback displayName）
//   2. LLM 生成文雅祝福 + 稱呼 → 個人化回應
//   3. 品質檢查，失敗重試（最多 2 次）
//   4. 仍失敗 → log + 通知主身（push 給 channel destination）

import { findContact } from '../data/contactRepo.js';
import { getClientByChannelKey } from '../lib/lineClient.js';
import { logger } from './logger.js';

// 模型設定：可從 skill flow config 覆蓋（雲端模型等）
export interface GreetingModelConfig {
  apiBase?: string;
  apiKey?: string;
  model?: string;
}

const DLLM_API_BASE = process.env.LLM_API_BASE ?? 'http://localhost:11400/v1';
const DLLM_API_KEY = process.env.LLM_API_KEY ?? '';
const LLM_MODEL = process.env.LLM_MODEL ?? 'Qwen3-8B-AWQ';

// 判斷是否為祝賀/問安類型（需走祝賀回覆分流）
export function isGreetingType(type: string | undefined): boolean {
  return !!(type && (type.includes('問安') || type.includes('祝福')));
}

// 找主身的朋友稱呼（title > nickname > honorific > displayName）
export function resolveSalutation(contact: {
  title?: string;
  nickname?: string;
  honorific?: string;
  salutation?: string;
  displayName: string;
}): string {
  return contact.salutation || contact.title || contact.honorific || contact.nickname || contact.displayName;
}

// LLM 生成文雅祝福（含稱呼）
async function generateReply(prompt: string, mc?: GreetingModelConfig): Promise<string> {
  const apiBase = mc?.apiBase ?? DLLM_API_BASE;
  const apiKey = mc?.apiKey ?? DLLM_API_KEY;
  const model = mc?.model ?? LLM_MODEL;
  const res = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: '你是文采優雅的業務助理，回覆簡短（1-2 句）且措辭雅緻，繁體中文。',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const j = (await res.json()) as any;
  return j?.choices?.[0]?.message?.content?.trim() ?? '';
}

// 品質檢查：非空且長度合理且含稱呼
function validateReply(reply: string, salutation: string): boolean {
  if (!reply || reply.length < 5) return false;
  if (!reply.includes(salutation)) return false; // 必須帶稱呼
  if (reply.length > 200) return false;          // 過長視為雜訊
  return true;
}

// 通知主身（push 給 channel destination）
async function notifyOwner(channelId: string, subject: string, detail: string): Promise<void> {
  try {
    const cc = await getClientByChannelKey(channelId);
    if (!cc || !cc.channel.destination) return;
    await cc.client.pushMessage({
      to: cc.channel.destination,
      messages: [{ type: 'text', text: `⚠️ 祝賀回覆失敗（${subject}）\n${detail}` }],
    });
    logger.warn('greeting.notify_owner', { channelId, subject });
  } catch (e) {
    logger.error('greeting.notify_owner_failed', { channelId, error: String(e) });
  }
}

// 完整個人化祝賀生成（稱呼 + 重試 + 通知）
export async function generatePersonalizedGreeting(input: {
  type: string;
  festival?: string;
  greeting_period?: string;
  greeting_content?: string;
  summary?: string;
  channelId: string;
  userId: string;
  modelConfig?: GreetingModelConfig;
}): Promise<{ ok: boolean; reply?: string; reason?: string }> {
  const { type, festival, greeting_period: period, greeting_content: content, summary } = input;
  const mc = input.modelConfig;

  // 1. 找主身的朋友（稱呼 + 性別 + 年齡段）
  let salutation = '親愛的朋友';
  let gender = '';
  let ageGroup = '';
  try {
    const contact = await findContact(input.channelId, input.userId);
    if (contact) {
      salutation = resolveSalutation(contact);
      gender = contact.gender ?? '';
      ageGroup = contact.ageGroup ?? '';
    }
  } catch (e) {
    logger.warn('greeting.contact_lookup_failed', { channelId: input.channelId, error: String(e) });
  }

  // 依性別/年齡段調整語氣：越年長越正式
  const genderNote = gender === 'male' ? '對方為男性' : gender === 'female' ? '對方為女性' : '';
  const ageNote = ageGroup
    ? ageGroup === '18-25' ? '對方較年輕（18-25 歲），語氣可親切活潑'
    : ageGroup === '26-35' ? '對方為青壯年（26-35 歲），語氣自然得體'
    : ageGroup === '36-45' ? '對方為中年（36-45 歲），語氣穩重有禮'
    : ageGroup === '46-60' ? '對方為中高齡（46-60 歲），語氣恭敬正式'
    : '對方為高齡長輩（60+），語氣莊重恭敬，用詞講究'
    : '未設定年齡段，視為青年，語氣親切活潑';
  const toneHint = [genderNote, ageNote].filter(Boolean).join('，');

  const isFestival = type.includes('祝福') || !!festival;
  const scene = isFestival ? `節慶「${festival || '祝賀'}」` : `問安時段「${period || '問候'}」`;
  const prompt = `收到${salutation}寄來的${type}（${scene}），圖片內容：${content || summary || ''}。
請以「${salutation}」為開頭稱呼，用文雅措辭回覆感謝對方的心意，簡短 1-2 句，不要自我介紹。${toneHint ? `\n語氣要求：${toneHint}。` : ''}`;

  // 2. 生成 + 品質檢查，重試最多 2 次
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const reply = await generateReply(prompt, mc);
      if (validateReply(reply, salutation)) {
        return { ok: true, reply };
      }
      lastError = `品質檢查未過（第 ${attempt + 1} 次）: ${reply.slice(0, 50)}`;
    } catch (e) {
      lastError = String(e);
    }
    logger.warn('greeting.retry', { channelId: input.channelId, attempt: attempt + 1, error: lastError });
  }

  // 3. 失敗 → log + 通知主身
  logger.error('greeting.generation_failed', { channelId: input.channelId, userId: input.userId, error: lastError });
  await notifyOwner(input.channelId, type, `稱呼：${salutation}\n錯誤：${lastError}`);
  return { ok: false, reason: lastError };
}
