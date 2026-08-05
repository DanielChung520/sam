// Built-in skill: web-search（真實網路搜尋）
//
// 真實呼叫搜尋 API（Serper → SerpAPI → Google CSE 依序 fallback），
// API key 從 server/.env 讀取（可設置）：
//   SERPER_API_KEY / SERPAPI_API_KEY / GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX
//
// 兩種用法：
//   1. inline handler 'web-search' — 對話直接呼叫，輸出人類可讀的中文列表
//   2. export serperSearch() — newsService 等內部使用，取結構化結果
//
// 同時保留 taskforge 摘要能力（summarize 參數）：搜尋結果 → LLM 整理成中文摘要。

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import { chatCompletion } from '../../llmClient.js';
import { logger } from '../../logger.js';

const SERPER_URL = 'https://google.serper.dev/search';

export interface SearchResultItem {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

interface ProviderConfig {
  enabled: boolean;
  apiKey: string;
  cx?: string;
}

function readProviderConfig(): { serper: ProviderConfig; serpapi: ProviderConfig; googleCse: ProviderConfig } {
  return {
    serper: { enabled: !!process.env.SERPER_API_KEY, apiKey: process.env.SERPER_API_KEY ?? '' },
    serpapi: { enabled: !!process.env.SERPAPI_API_KEY, apiKey: process.env.SERPAPI_API_KEY ?? '' },
    googleCse: {
      enabled: !!(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX),
      apiKey: process.env.GOOGLE_CSE_API_KEY ?? '',
      cx: process.env.GOOGLE_CSE_CX ?? '',
    },
  };
}

// 依優先序嘗試各 provider，回傳第一組成功的結果
export async function searchWeb(query: string, num = 10): Promise<SearchResultItem[]> {
  const { serper, serpapi, googleCse } = readProviderConfig();

  // 1. Serper
  if (serper.enabled) {
    try {
      const res = await fetch(SERPER_URL, {
        method: 'POST',
        headers: { 'X-API-KEY': serper.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: Math.min(num, 100), gl: 'tw', hl: 'zh-tw' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { answerBox?: { title?: string; link?: string; snippet?: string }; organic?: Array<{ title?: string; link?: string; snippet?: string }> };
        const items: SearchResultItem[] = [];
        if (data.answerBox?.title) {
          items.push({
            title: data.answerBox.title,
            link: data.answerBox.link ?? '',
            snippet: data.answerBox.snippet ?? '',
            position: 0,
          });
        }
        for (const [i, r] of (data.organic ?? []).entries()) {
          items.push({
            title: r.title ?? '',
            link: r.link ?? '',
            snippet: r.snippet ?? '',
            position: i + 1,
          });
        }
        if (items.length > 0) return items;
      }
      logger.warn('webSearch.serper_failed', { query, status: res.status });
    } catch (e) {
      logger.warn('webSearch.serper_error', { query, error: String(e) });
    }
  }

  // 2. SerpAPI
  if (serpapi.enabled) {
    try {
      const params = new URLSearchParams({ q: query, num: String(Math.min(num, 20)), api_key: serpapi.apiKey, engine: 'google' });
      const res = await fetch(`https://serpapi.com/search?${params}`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const data = (await res.json()) as { answer_box?: { title?: string; link?: string; answer?: string }; organic_results?: Array<{ title?: string; link?: string; snippet?: string }> };
        const items: SearchResultItem[] = [];
        if (data.answer_box?.title) {
          items.push({
            title: data.answer_box.title,
            link: data.answer_box.link ?? '',
            snippet: data.answer_box.answer ?? '',
            position: 0,
          });
        }
        for (const [i, r] of (data.organic_results ?? []).entries()) {
          items.push({
            title: r.title ?? '',
            link: r.link ?? '',
            snippet: r.snippet ?? '',
            position: i + 1,
          });
        }
        if (items.length > 0) return items;
      }
      logger.warn('webSearch.serpapi_failed', { query, status: res.status });
    } catch (e) {
      logger.warn('webSearch.serpapi_error', { query, error: String(e) });
    }
  }

  // 3. Google CSE（免費額度：每日 100 次）
  if (googleCse.enabled) {
    try {
      const params = new URLSearchParams({
        key: googleCse.apiKey,
        cx: googleCse.cx ?? '',
        q: query,
        num: String(Math.min(num, 10)),
      });
      const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const data = (await res.json()) as { items?: Array<{ title?: string; link?: string; snippet?: string }> };
        const items = (data.items ?? []).map((r, i) => ({
          title: r.title ?? '',
          link: r.link ?? '',
          snippet: r.snippet ?? '',
          position: i + 1,
        }));
        if (items.length > 0) return items;
      }
      logger.warn('webSearch.google_cse_failed', { query, status: res.status });
    } catch (e) {
      logger.warn('webSearch.google_cse_error', { query, error: String(e) });
    }
  }

  logger.warn('webSearch.all_providers_failed', { query });
  return [];
}

// 搜尋結果 → LLM 整理成中文摘要（maxItems 控制條數，保留真實連結）
export async function summarizeSearchResults(
  query: string,
  results: SearchResultItem[],
  maxItems = 5,
): Promise<string> {
  const top = results.slice(0, maxItems);
  const list = top
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   連結：${r.link}`)
    .join('\n');
  try {
    const res = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是網路搜尋整理助理。請將搜尋結果整理成條列式中文摘要，保留原始連結。',
        },
        {
          role: 'user',
          content: `搜尋主題：${query}\n\n搜尋結果：\n${list}\n\n請用繁體中文整理成精簡摘要，標註資料來源（含連結）。`,
        },
      ],
      temperature: 0.3,
      maxTokens: 600,
      timeoutMs: 30_000,
    });
    return res.content.trim();
  } catch (e) {
    logger.warn('webSearch.summarize_failed', { query, error: String(e) });
    // LLM 失敗時直接輸出原始結果列表
    return top.map((r) => `${r.title}\n${r.snippet}\n${r.link}`).join('\n\n');
  }
}

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const query = String(args.query ?? '').trim();
  if (!query) return { ok: false, output: '請提供要搜尋的內容，例如「搜尋 台積電最新新聞」' };

  try {
    const results = await searchWeb(query, 10);
    if (results.length === 0) {
      return { ok: false, output: '搜尋失敗，目前所有搜尋服務都無法連線，請稍後再試。' };
    }

    // summarize 參數：true → LLM 摘要（預設），false → 原始條列
    if (args.summarize === false) {
      const lines = results.slice(0, 10).map((r) => `${r.title}\n${r.link}\n${r.snippet}`);
      return { ok: true, output: lines.join('\n\n') };
    }

    const summary = await summarizeSearchResults(query, results);
    return { ok: true, output: summary };
  } catch (e) {
    logger.warn('webSearch.handler_error', { query, error: String(e) });
    return { ok: false, output: '搜尋時發生錯誤，請稍後再試。' };
  }
};

registerInlineHandler('web-search', handler);

const manifest: SkillManifest = {
  id: 'web-search',
  name: '網路搜尋',
  description: '真實上網搜尋資料並整理成中文摘要',
  triggers: ['search', 'find', 'look up', '查詢', '搜尋', '找', '上網'],
  parameters: [
    { name: 'query', type: 'string', required: true, description: '搜尋關鍵字' },
    { name: 'summarize', type: 'boolean', required: false, description: '是否用 LLM 整理摘要（預設 true）' },
  ],
  executor: { type: 'inline', handler: 'web-search' },
  timeoutMs: 45_000,
};

export default manifest;
