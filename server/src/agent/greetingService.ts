// Greeting 祝賀/問安回覆服務
//
// 依 OCR 分類結果（問安卡 / 祝福賀卡）生成個人化祝賀回覆。
// OCR 只負責解析與分類，祝賀生成由本模組負責（分流處理模式）。

const DLLM_API_BASE = process.env.LLM_API_BASE ?? 'http://localhost:11400/v1';
const DLLM_API_KEY = process.env.LLM_API_KEY ?? '';
const LLM_MODEL = process.env.LLM_MODEL ?? 'Qwen3-8B-AWQ';

// 判斷是否為祝賀/問安類型（需走祝賀回覆分流）
export function isGreetingType(type: string | undefined): boolean {
  return !!(type && (type.includes('問安') || type.includes('祝福')));
}

// 生成個人化祝賀/問安回覆
export async function generateGreetingReply(parsed: {
  type?: string;
  festival?: string;
  greeting_period?: string;
  greeting_content?: string;
  summary?: string;
}): Promise<string> {
  const type = parsed.type ?? '';
  const festival = parsed.festival ?? '';
  const period = parsed.greeting_period ?? '';
  const content = parsed.greeting_content ?? '';

  const isFestival = type.includes('祝福') || !!festival;
  const scene = isFestival ? `節慶「${festival || '祝賀'}」` : `問安時段「${period || '問候'}」`;
  const prompt = `收到客戶寄來的${type}（${scene}），圖片內容：${content || parsed.summary || ''}。
請以溫暖、真摯、簡短（1-2 句）的繁體中文回覆對方，感謝並回應對方的心意，不要自我介紹。`;

  const res = await fetch(`${DLLM_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(DLLM_API_KEY ? { Authorization: `Bearer ${DLLM_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: '你是親切溫暖的業務助理，回覆簡短真摯。' },
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
