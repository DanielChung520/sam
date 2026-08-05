// News Service — 新聞抓取 + AI 摘要 + 分析
//
// 流程：依訂閱主題 → 真實網路搜尋（Serper，見 webSearch.ts）拿最新新聞標題/連結/摘要
// → LLM 依分析 prompt 生成分析 → 存 news_items（每主題一筆最新）。
//
// 抓取與分析都失敗時 fallback：單獨抓取成功仍有新聞，分析失敗不阻斷儲存。

import { chatCompletion } from './llmClient.js';
import { searchWeb, type SearchResultItem } from './skills/manifests/webSearch.js';
import { upsertNewsItem, type NewsSubscription } from '../data/newsRepo.js';
import { logger } from './logger.js';

const SUMMARY_LEN_HINT: Record<NewsSubscription['summaryLen'], string> = {
  short: '請用 1-2 句（100 字以內）摘要',
  medium: '請用 3-4 句（200 字以內）摘要',
  full: '請詳細摘要（400 字以內）',
};

const CATEGORY_HINTS = ['今日焦點', '產業', '科技'];

/** 抓取單一主題的新聞並分析（供排程 job 與手動觸發共用） */
export async function fetchTopicNews(
  channelId: string,
  sub: NewsSubscription,
  topic: string,
): Promise<void> {
  const collected = await collectTopicNews(topic);
  if (!collected) {
    logger.warn('news.collect_empty', { channelId, topic });
    return;
  }

  const summary = await summarizeNews(sub, topic, collected);
  const analysis = sub.autoSummarize
    ? await analyzeNews(sub, topic, collected, summary)
    : undefined;

  await upsertNewsItem(channelId, topic, {
    category: pickCategory(topic),
    title: collected.title,
    summary,
    source: collected.source,
    time: '剛剛',
    analysis,
    url: collected.url,
  });
  logger.info('news.fetched', { channelId, topic, len: summary.length });
}

/** 對某 channel 的所有訂閱主題抓一輪 */
export async function fetchAllTopics(channelId: string, sub: NewsSubscription): Promise<void> {
  for (const topic of sub.topics) {
    try {
      await fetchTopicNews(channelId, sub, topic);
    } catch (e) {
      logger.warn('news.topic_failed', { channelId, topic, error: String(e) });
    }
  }
}

// ─── 抓取 ────────────────────────────────────────────────

interface RawNews {
  title: string;
  summary: string;
  source: string;
  url?: string;
}

// 真實搜尋：Serper 抓最新新聞 → LLM 整理成 RawNews
async function collectTopicNews(topic: string): Promise<RawNews | null> {
  try {
    const results = await searchWeb(topic, 10);
    if (results.length === 0) {
      logger.warn('news.collect_empty', { topic });
      return null;
    }

    const news = await pickTopNews(topic, results);
    return news;
  } catch (e) {
    logger.warn('news.collect_failed', { topic, error: String(e) });
    return null;
  }
}

// LLM 從搜尋結果挑選最相關的單一新聞，整理成 { title, summary, source, url }
async function pickTopNews(topic: string, results: SearchResultItem[]): Promise<RawNews | null> {
  const list = results
    .slice(0, 10)
    .map((r, i) => `${i + 1}. ${r.title}\n   摘要：${r.snippet}\n   來源：${r.link}`)
    .join('\n');
  try {
    const res = await chatCompletion({
      messages: [
        {
          role: 'system',
          content:
            '你是新聞編輯。從搜尋結果中挑選「與主題最相關、最新的一則」新聞，' +
            '嚴格輸出 JSON（不要 markdown 包裹）：\n' +
            '{ "title": "新聞標題", "summary": "2-3 句中文摘要（100-200 字）", "source": "來源網站名稱", "url": "原文連結" }',
        },
        {
          role: 'user',
          content: `主題：${topic}\n\n搜尋結果：\n${list}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 400,
      timeoutMs: 30_000,
      jsonMode: true,
    });
    return parseRawNews(res.content);
  } catch (e) {
    logger.warn('news.pick_failed', { topic, error: String(e) });
    // LLM 失敗時退回第一筆結果
    const first = results[0];
    return {
      title: first.title,
      summary: first.snippet,
      source: sourceFromUrl(first.link),
      url: first.link || undefined,
    };
  }
}

function sourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '網路新聞';
  }
}

function parseRawNews(output: string): RawNews | null {
  try {
    const j = JSON.parse(output);
    return {
      title: String(j.title ?? ''),
      summary: String(j.summary ?? ''),
      source: String(j.source ?? '未知來源'),
      url: j.url ? String(j.url) : undefined,
    };
  } catch {
    const m = output.match(/[「"']([^」"']{5,60})[」"']/);
    return {
      title: m?.[1] ?? topicFallbackTitle(output),
      summary: output.slice(0, 200),
      source: '網路新聞',
    };
  }
}

function topicFallbackTitle(output: string): string {
  const firstLine = output.split('\n')[0]?.slice(0, 40) ?? '';
  return firstLine || '最新新聞';
}

/** 依主題分類（無法判斷 → 今日焦點） */
function pickCategory(topic: string): string {
  if (/科技|AI|半導體|晶片|軟體|網路|數位/.test(topic)) return '科技';
  if (/產業|製造|供應鏈|經濟|市場/.test(topic)) return '產業';
  return CATEGORY_HINTS[0];
}

// ─── AI 摘要與分析 ───────────────────────────────────────

async function summarizeNews(
  sub: NewsSubscription,
  topic: string,
  news: RawNews,
): Promise<string> {
  if (!sub.autoSummarize) return news.summary;
  try {
    const res = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是專業的新聞摘要助理，只輸出摘要內容本身，不要任何前言或格式。',
        },
        {
          role: 'user',
          content:
            `${SUMMARY_LEN_HINT[sub.summaryLen]}。\n` +
            `主題：${topic}\n標題：${news.title}\n內文：${news.summary}\n來源：${news.source}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 400,
      timeoutMs: 30_000,
    });
    return res.content.trim();
  } catch (e) {
    logger.warn('news.summarize_failed', { topic, error: String(e) });
    return news.summary;
  }
}

async function analyzeNews(
  sub: NewsSubscription,
  topic: string,
  news: RawNews,
  summary: string,
): Promise<string | undefined> {
  const prompt = sub.analysisPrompt?.trim();
  if (!prompt) return undefined;
  try {
    const rendered = prompt
      .replaceAll('{標題}', news.title)
      .replaceAll('{摘要}', summary)
      .replaceAll('{主題}', topic)
      .replaceAll('{來源}', news.source);
    const res = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是銷售助理的新聞分析助手，依指示分析新聞並給出務實建議。',
        },
        { role: 'user', content: rendered },
      ],
      temperature: 0.4,
      maxTokens: 500,
      timeoutMs: 30_000,
    });
    return res.content.trim();
  } catch (e) {
    logger.warn('news.analyze_failed', { topic, error: String(e) });
    return undefined;
  }
}
