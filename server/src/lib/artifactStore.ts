// 工作產出物儲存 — markdown 產出 → HTML 文件存到 SeaweedFS（fileStorage）
//
// 回覆 LINE 時只回「標題 + 分享連結」，完整內容以 HTML 頁面呈現。

import { randomUUID } from 'node:crypto';
import { getFileStorage } from './fileStorage.js';
import { createFileRecord, ensureFilesCollection } from '../data/filesRepo.js';
import { createShareToken } from './shareToken.js';
import { markdownToHtml } from './markdownToHtml.js';
import { logger } from '../agent/logger.js';

const SHARE_SECRET = process.env.FILE_SHARE_SECRET ?? 'sam-share-secret-change-me';
const EXPIRY_SEC = 7 * 24 * 3600;

function sanitizeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_').slice(0, 60) || 'document';
}

export interface ArtifactRef {
  title: string;
  shareUrl: string;
  fileId: string;
}

// 對外公開 base（LINE 使用者點擊連結用）— 依環境設定
function publicBase(): string {
  const env = process.env.PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, '');
  return 'http://localhost:7010';
}

export async function saveArtifact(input: {
  channelId: string;
  title: string;
  markdown: string;
  ownerUserId?: string;
  businessOwnerId?: string;
}): Promise<ArtifactRef> {
  const { channelId, title, markdown } = input;
  const safeName = sanitizeName(title);
  const html = markdownToHtml(markdown);
  const storage = getFileStorage();

  const fileId = randomUUID();
  const htmlKey = `${channelId}/artifacts/${fileId}-${safeName}.html`;
  const mdKey = `${channelId}/artifacts/${fileId}-${safeName}.md`;

  await storage.put(htmlKey, Buffer.from(html, 'utf8'), 'text/html');
  await storage.put(mdKey, Buffer.from(markdown, 'utf8'), 'text/markdown');

  await ensureFilesCollection();
  const record = await createFileRecord({
    channelId,
    ownerUserId: input.ownerUserId ?? 'system',
    storageKey: htmlKey,
    filename: `${safeName}.html`,
    contentType: 'text/html',
    size: Buffer.byteLength(html),
    metadata: { source: 'agent-artifact', title, markdownKey: mdKey },
    businessOwnerId: input.businessOwnerId,
  });

  const token = createShareToken({
    fileId: record.fileId,
    channelId,
    expiresInSec: EXPIRY_SEC,
    secret: SHARE_SECRET,
  });

  logger.info('artifact.saved', { channelId, fileId: record.fileId, title, htmlBytes: Buffer.byteLength(html) });

  return {
    title,
    shareUrl: `${publicBase()}/api/v1/files/share/${token}`,
    fileId: record.fileId,
  };
}
