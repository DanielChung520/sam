// Card 名片服務 — 名片感謝回覆生成
//
// OCR 分類為「名片」時，依姓名/職稱生成個人化感謝回覆。

const DLLM_API_BASE = process.env.LLM_API_BASE ?? 'http://localhost:11400/v1';
const DLLM_API_KEY = process.env.LLM_API_KEY ?? '';
const LLM_MODEL = process.env.LLM_MODEL ?? 'Qwen3-8B-AWQ';

export async function generateCardThankYou(name: string, title: string): Promise<string> {
  const prompt = `客戶提供了名片：${name || '未知'}${title ? `，職稱 ${title}` : ''}。
請以簡短（1 句）真摯的繁體中文感謝對方，提到對方姓名，表達樂於保持聯繫，不要自我介紹。`;

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
      max_tokens: 100,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const j = (await res.json()) as any;
  return j?.choices?.[0]?.message?.content?.trim() ?? '';
}
