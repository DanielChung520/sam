// Files API: upload + GET + share-token
//
// 所有檔案操作都帶 channelId 隔離。

import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { logger } from '../agent/logger.js';
import { getFileStorage } from '../lib/fileStorage.js';
import {
  createFileRecord,
  findFileById,
  findFileByKey,
  findByShortCode,
  deleteFileRecord,
  ensureFilesCollection,
  type FileRecord,
} from '../data/filesRepo.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const SHARE_SECRET = process.env.FILE_SHARE_SECRET ?? 'sam-share-secret-change-me';
const DEFAULT_EXPIRY_SEC = 7 * 24 * 3600;

function buildStorageKey(channelId: string, fileId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${channelId}/${fileId}-${safe}`;
}

async function importTokenModule() {
  const mod = await import('../lib/shareToken.js');
  return mod;
}

router.post('/upload', upload.single('file'), async (req: any, res: any) => {
  await ensureFilesCollection();
  try {
    const file = (req as any).file;
    const channelId = req.body?.channelId as string;
    const ownerUserId = req.body?.userId as string | undefined;
    const businessOwnerId = req.body?.businessOwnerId as string | undefined;

    if (!file) {
      return res.status(400).json({ error: 'file is required (multipart field "file")' });
    }
    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required' });
    }

    const tmpFileId = randomUUID();
    const finalKey = buildStorageKey(channelId, tmpFileId, file.originalname);

    const storage = getFileStorage();
    await storage.put(finalKey, file.buffer, file.mimetype || 'application/octet-stream');

    const record = await createFileRecord({
      channelId,
      ownerUserId: ownerUserId ?? 'anonymous',
      storageKey: finalKey,
      filename: file.originalname,
      contentType: file.mimetype || 'application/octet-stream',
      size: file.size,
      metadata: { source: 'api-upload' },
      businessOwnerId,
    });

    const tokenMod = await importTokenModule();
    const expiresIn = Number(req.body?.expiresInSec ?? DEFAULT_EXPIRY_SEC);
    const token = tokenMod.createShareToken({
      fileId: record.fileId,
      channelId,
      expiresInSec: expiresIn,
      secret: SHARE_SECRET,
    });

    logger.info('files.upload', {
      fileId: record.fileId,
      channelId,
      filename: file.originalname,
      size: file.size,
    });

    return res.json({
      fileId: record.fileId,
      filename: file.originalname,
      size: file.size,
      contentType: file.mimetype,
      shareUrl: `/api/v1/files/share/${token}`,
      expiresInSec: expiresIn,
    });
  } catch (e: unknown) {
    logger.error('files.upload.failed', { error: String(e) });
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/:fileId', async (req: any, res: any) => {
  await ensureFilesCollection();
  const fileId = req.params.fileId;
  const channelId = req.query.channelId as string;
  if (!channelId) {
    return res.status(400).json({ error: 'channelId query param required' });
  }
  const file = await findFileById(fileId, channelId);
  if (!file) {
    return res.status(404).json({ error: 'file not found or channel mismatch' });
  }
  try {
    const storage = getFileStorage();
    const { body, contentType } = await storage.get(file.storageKey);
    res.setHeader('Content-Type', contentType || file.contentType);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    res.send(body);
  } catch (e: unknown) {
    logger.error('files.get.failed', { fileId, error: String(e) });
    return res.status(500).json({ error: 'failed to read file' });
  }
});

router.delete('/:fileId', async (req: any, res: any) => {
  await ensureFilesCollection();
  const fileId = req.params.fileId;
  const channelId = req.query.channelId as string;
  if (!channelId) {
    return res.status(400).json({ error: 'channelId query param required' });
  }
  const file = await findFileById(fileId, channelId);
  if (!file) {
    return res.status(404).json({ error: 'file not found or channel mismatch' });
  }
  try {
    const storage = getFileStorage();
    await storage.delete(file.storageKey);
    await deleteFileRecord(fileId, channelId);
    logger.info('files.deleted', { fileId, channelId });
    return res.json({ ok: true });
  } catch (e: unknown) {
    logger.error('files.delete.failed', { fileId, error: String(e) });
    return res.status(500).json({ error: 'failed to delete file' });
  }
});

router.get('/share/:code', async (req: any, res: any) => {
  await ensureFilesCollection();
  const code = req.params.code;

  // 新版：8 字元短碼（無資訊洩漏，DB 查映射 + 效期欄位）
  if (code.length <= 12 && !code.includes('.')) {
    const file = await findByShortCode(code);
    if (!file) {
      return res.status(404).json({ error: 'link not found' });
    }
    const expiresAt = (file.metadata as any)?.shareExpiresAt as number | undefined;
    if (expiresAt && expiresAt < Date.now()) {
      return res.status(410).json({ error: 'link expired' });
    }
    try {
      const storage = getFileStorage();
      const { body, contentType } = await storage.get(file.storageKey);
      res.setHeader('Content-Type', contentType || file.contentType);
      res.setHeader('Content-Length', String(body.length));
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
      return res.send(body);
    } catch (e: unknown) {
      logger.error('files.share.failed', { fileId: file.fileId, error: String(e) });
      return res.status(500).json({ error: 'failed to read file' });
    }
  }

  // 舊版：HMAC token（相容既有分享連結）
  const tokenMod = await importTokenModule();
  const decoded = tokenMod.verifyShareToken({
    token: code,
    secret: SHARE_SECRET,
  });
  if (!decoded) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
  const file = await findFileByKey(decoded.fileId);
  if (!file) {
    return res.status(404).json({ error: 'file not found' });
  }
  try {
    const storage = getFileStorage();
    const { body, contentType } = await storage.get(file.storageKey);
    res.setHeader('Content-Type', contentType || file.contentType);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    return res.send(body);
  } catch (e: unknown) {
    logger.error('files.share.failed', { fileId: decoded.fileId, error: String(e) });
    return res.status(500).json({ error: 'failed to read file' });
  }
});

export default router;