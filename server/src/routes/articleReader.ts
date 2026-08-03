import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(
      auth.slice(7),
      process.env.JWT_SECRET || 'dev-secret',
    ) as { sub: string };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(authMiddleware);

interface ArticleResult {
  url: string;
  title: string;
  description: string;
  textContent: string;
  excerpt: string;
  siteName: string;
}

/**
 * Extract <title> from HTML string.
 */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : '';
}

/**
 * Extract meta property/name value (og:title, description, etc.).
 */
function extractMeta(html: string, property: string): string {
  // Open Graph: <meta property="og:title" content="..." />
  const og = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    'i',
  ).exec(html);
  if (og) return og[1].trim();

  // Reverse order: content="..." property="og:title"
  const rev = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  ).exec(html);
  return rev ? rev[1].trim() : '';
}

/**
 * Strip HTML tags, scripts, styles and return clean text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' (header) ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Try to extract main article content from HTML:
 * Prefer <article> tag, then <main>, then <body>.
 */
function extractMainContent(html: string): string {
  // Try <article> first
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (article) return stripHtml(article[1]);

  // Try <main>
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (main) return stripHtml(main[1]);

  // Try role="main"
  const roleMain = html.match(/<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (roleMain) return stripHtml(roleMain[1]);

  // Fallback: <body>
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (body) {
    // Get first 8000 chars of body (beyond nav/header/footer)
    const cleaned = stripHtml(body[1]);
    const lines = cleaned.split('\n').filter((l) => l.trim().length > 40);
    return lines.slice(0, 40).join('\n').slice(0, 8000);
  }

  // Last resort: entire HTML stripped
  return stripHtml(html).slice(0, 8000);
}

/**
 * Generate a short excerpt (first ~200 chars of text content).
 */
function makeExcerpt(text: string, maxLen = 200): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

/**
 * Guess site name from URL.
 */
function guessSiteName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

router.post('/read', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "url" field' });
    }

    // Validate URL format
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: 'Only http/https URLs are supported' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SAMArticleReader/1.0; +https://la.aiconn.ai)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({
        error: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}`,
      });
    }

    const html = await response.text();
    if (!html || html.length < 50) {
      return res.status(502).json({ error: 'Response content is empty or too short' });
    }

    const title =
      extractMeta(html, 'og:title') ||
      extractMeta(html, 'twitter:title') ||
      extractTitle(html);

    const description =
      extractMeta(html, 'og:description') ||
      extractMeta(html, 'description') ||
      extractMeta(html, 'twitter:description') ||
      '';

    const textContent = extractMainContent(html);
    const excerpt = makeExcerpt(textContent);
    const siteName =
      extractMeta(html, 'og:site_name') || guessSiteName(url);

    const result: ArticleResult = {
      url,
      title,
      description,
      textContent,
      excerpt,
      siteName,
    };

    res.json({ data: result });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out (15s)' });
    }
    console.error('Article reader error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

/**
 * Summarize an article using the configured LLM.
 * POST /api/v1/article-reader/summarize
 * Body: { url: string } | { title: string, textContent: string, url: string }
 */
router.post('/summarize', async (req, res) => {
  try {
    const { url, title, textContent } = req.body;

    // Accept either a URL (fetch+summarize) or pre-extracted content
    let article: ArticleResult;

    if (url && !textContent) {
      // Fetch first
      const fetchRes = await fetch(
        `http://localhost:${process.env.PORT || 9091}/api/v1/article-reader/read`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization || '',
          },
          body: JSON.stringify({ url }),
        },
      );
      if (!fetchRes.ok) {
        const err = await fetchRes.json();
        return res.status(fetchRes.status).json(err);
      }
      const fetchData = (await fetchRes.json()) as { data: ArticleResult };
      article = fetchData.data;
    } else if (textContent) {
      article = {
        url: url || '',
        title: title || '',
        description: '',
        textContent,
        excerpt: makeExcerpt(textContent),
        siteName: url ? guessSiteName(url) : '',
      };
    } else {
      return res.status(400).json({
        error: 'Provide either "url" to fetch, or "title"+"textContent" for direct input',
      });
    }

    // For now, return the article data + excerpt as the "summary"
    // The actual LLM summarization will happen in the webhook pipeline
    res.json({
      data: {
        ...article,
        summary: article.excerpt,
        summaryNote:
          'Full LLM summarization to be implemented in webhook pipeline',
      },
    });
  } catch (err: any) {
    console.error('Article summarize error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

export default router;
