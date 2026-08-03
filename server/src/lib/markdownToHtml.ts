// 輕量 markdown → HTML 轉換（產出「段落分明」的可讀文件）
//
// 支援：標題 #~####、粗體 **、斜體 *、有序/無序列表、引用、程式碼塊、連結、分隔線、段落。
// 輸出完整 HTML 文件（含內建簡潔 CSS），適合存 SeaweedFS 後以瀏覽器開啟。

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return out;
}

function extractTitle(md: string): string {
  const heading = md.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const json = md.match(/"title"\s*:\s*"([^"]+)"/);
  if (json) return json[1].trim();
  const firstLine = md.split('\n').find((l) => l.trim());
  return (firstLine ?? '文件').trim().slice(0, 60);
}

export function markdownToHtml(md: string): string {
  const title = extractTitle(md);
  const lines = md.split('\n');
  const body: string[] = [];
  let i = 0;

  const renderList = (ordered: boolean, items: string[]): void => {
    const tag = ordered ? 'ol' : 'ul';
    body.push(`<${tag}>`);
    for (const it of items) body.push(`<li>${inline(it)}</li>`);
    body.push(`</${tag}>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      body.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (line.trim() === '---' || line.trim() === '***') {
      body.push('<hr/>');
      i++;
      continue;
    }

    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const lang = fence[1];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      body.push(`<pre class="code ${lang}"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quotes: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quotes.push(inline(lines[i].replace(/^\s*>\s?/, '')));
        i++;
      }
      body.push(`<blockquote>${quotes.join('<br/>')}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      renderList(false, items);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      renderList(true, items);
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    // 一般段落：合併連續非空行
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      para.push(lines[i]);
      i++;
    }
    body.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; color: #1f2937; line-height: 1.75; background: #fafafa; }
  h1 { font-size: 26px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
  h2 { font-size: 21px; margin-top: 28px; }
  h3 { font-size: 17px; margin-top: 20px; }
  h4 { font-size: 15px; margin-top: 16px; }
  p { margin: 10px 0; }
  ul, ol { padding-left: 24px; }
  li { margin: 4px 0; }
  blockquote { border-left: 4px solid #059669; background: #ecfdf5; margin: 12px 0; padding: 10px 14px; color: #374151; border-radius: 0 8px 8px 0; }
  pre { background: #111827; color: #f9fafb; padding: 14px; border-radius: 10px; overflow-x: auto; font-size: 13px; }
  code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; font-size: 13px; }
  pre code { background: none; padding: 0; }
  a { color: #059669; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  .foot { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
</style>
</head>
<body>
${body.join('\n')}
<div class="foot">由 SAM 分身助理產出</div>
</body>
</html>`;
}
