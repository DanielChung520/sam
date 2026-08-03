// Built-in skill: readme
// 產生所有可用指令的說明文件（HTML），存入 SeaweedFS 並回傳分享鏈接

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import { buildSlashMenu } from '../../slashMenu.js';
import { getFileStorage } from '../../../lib/fileStorage.js';
import { createFileRecord, ensureFilesCollection } from '../../../data/filesRepo.js';
import { createShareToken } from '../../../lib/shareToken.js';
import { logger } from '../../logger.js';

const SHARE_SECRET = process.env.FILE_SHARE_SECRET ?? 'sam-share-secret-change-me';
const README_EXPIRY_SEC = 7 * 24 * 60 * 60;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTable(rows: string[]): string {
  return `<table><thead><tr><th>指令</th><th>名稱</th><th>用法</th><th>說明</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

async function generateReadmeHtml(channelId: string): Promise<string> {
  const menu = await buildSlashMenu(channelId);
  const now = new Date();
  const versionTime = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  const group = (label: string, emoji: string, items: typeof menu, render: (m: any) => string): string => {
    if (items.length === 0) return '';
    return `<section><h2>${emoji} ${esc(label)}</h2>${renderTable(items.map(render))}</section>`;
  };

  const mainSection = group('主 Agents（會自己做決策）', '🤖', menu.filter((m) => m.type === 'main_agent'), (m) =>
    `<tr><td><code>/${esc(m.name)}</code></td><td>${esc(m.name)}</td><td><code>/${esc(m.name)} 內容</code></td><td>${esc(m.description)}</td></tr>`
  );

  const subSection = group('Sub-Agents（執行單一任務）', '⚙️', menu.filter((m) => m.type === 'sub_agent'), (m) =>
    `<tr><td><code>/${esc(m.name)}</code></td><td>${esc(m.name)}</td><td><code>/${esc(m.name)} 內容</code></td><td>${esc(m.description)}</td></tr>`
  );

  const skillSection = group('Skills（即時工具）', '🛠', menu.filter((m) => m.type === 'skill'), (m) => {
    const hint = m.argHint ? ` <${esc(m.argHint)}>` : '';
    const triggers = m.triggers?.length ? `<div class="trig">觸發：${esc(m.triggers.slice(0, 3).join('、'))}</div>` : '';
    return `<tr><td><code>/${esc(m.name)}${hint}</code></td><td>${esc(m.name)}</td><td>${m.argHint ? `<code>/${esc(m.name)} ${esc(m.argHint)}</code>` : '直接輸入'}${triggers}</td><td>${esc(m.description)}</td></tr>`;
  });

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>sam 分身助理 — 可用指令總覽</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif; background: #f0f2f5; color: #1e293b; line-height: 1.6; padding: 24px; }
  .wrap { max-width: 960px; margin: 0 auto; }
  .hero { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #fff; border-radius: 16px; padding: 28px 32px; margin-bottom: 24px; }
  .hero h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .hero p { font-size: 13px; opacity: 0.9; }
  section { background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  section h2 { font-size: 16px; font-weight: 700; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #0f766e; }
  .trig { font-size: 11px; color: #94a3b8; margin-top: 3px; }
  .system { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .sys-item { background: #f8fafc; border-radius: 10px; padding: 14px 16px; border: 1px solid #f1f5f9; }
  .sys-item code { font-size: 13px; font-weight: 600; }
  .sys-item p { font-size: 12px; color: #64748b; margin-top: 4px; }
  footer { text-align: center; font-size: 12px; color: #94a3b8; padding: 16px 0 8px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>sam LINE 分身助理 — 可用指令總覽</h1>
    <p>最後更新：${esc(versionTime)} ｜ Channel：<code style="background:rgba(255,255,255,0.15);color:#fff">${esc(channelId)}</code></p>
    <p style="margin-top:6px">回覆數字選擇，或直接輸入 <code style="background:rgba(255,255,255,0.15);color:#fff">/指令 內容</code>。指令不分大小寫，支援部分匹配。</p>
  </div>
  ${mainSection}
  ${subSection}
  ${skillSection}
  <section>
    <h2>📋 系統指令（預設可用）</h2>
    <div class="system">
      <div class="sys-item"><code>/</code><p>顯示此功能選單</p></div>
      <div class="sys-item"><code>/new</code><p>重置對話（清短期記憶，保留長期記憶）</p></div>
      <div class="sys-item"><code>/help</code><p>顯示簡短指令說明</p></div>
      <div class="sys-item"><code>/readme</code><p>產生這份指令文件</p></div>
    </div>
  </section>
  <footer>sam LINE Agent Platform ｜ 此文件由 /readme 動態產生</footer>
</div>
</body>
</html>`;
}

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const channelId = String(args.channelId ?? args.conversationChannelId ?? '');
  if (!channelId) {
    return { ok: false, output: '無法產生文件：缺少 channel 資訊。' };
  }

  try {
    await ensureFilesCollection();
    const html = await generateReadmeHtml(channelId);

    const storageKey = `readme/${channelId}/${Date.now()}-commands.html`;
    const storage = getFileStorage();
    const buffer = Buffer.from(html, 'utf8');
    await storage.put(storageKey, buffer, 'text/html');

    const record = await createFileRecord({
      channelId,
      ownerUserId: String(args.userId ?? 'system'),
      storageKey,
      filename: 'commands.html',
      contentType: 'text/html',
      size: buffer.length,
      metadata: { source: 'readme-skill', generatedAt: Date.now() },
    });

    const token = createShareToken({
      fileId: record.fileId,
      channelId,
      expiresInSec: README_EXPIRY_SEC,
      secret: SHARE_SECRET,
    });

    const base = process.env.PUBLIC_BASE_URL ?? 'https://la.aiconn.ai';
    const url = `${base}/api/v1/files/share/${token}`;

    logger.info('readme.generated', { channelId, storageKey, fileId: record.fileId });
    return {
      ok: true,
      output: `📋 已為您產生完整指令文件（HTML，有效期 7 天）：\n\n${url}\n\n文件包含所有主 Agent、Sub-Agent、Skill 與系統指令的用途、用法與能力說明。`,
    };
  } catch (e) {
    logger.error('readme.failed', { channelId, error: String(e) });
    return { ok: false, output: '產生指令文件時發生錯誤，請稍後再試。' };
  }
};

registerInlineHandler('readme', handler);

const manifest: SkillManifest = {
  id: 'readme',
  name: '指令文件（README）',
  description: '產生所有可用指令的說明文件並回傳分享鏈接',
  triggers: ['readme', '指令文件', '說明文件', '文件'],
  parameters: [
    { name: 'channelId', type: 'string', required: true, description: 'LINE channel id' },
    { name: 'userId', type: 'string', required: false, description: 'LINE userId' },
  ],
  executor: { type: 'inline', handler: 'readme' },
  timeoutMs: 30_000,
};

export default manifest;
