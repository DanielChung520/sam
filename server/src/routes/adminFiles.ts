// Admin Files endpoint — list all files across channels + token management

import { Router } from 'express';
import { logger } from '../agent/logger.js';
import { ensureFilesCollection, findFileByKey, deleteFileRecord, type FileRecord } from '../data/filesRepo.js';
import { getFileStorage } from '../lib/fileStorage.js';
import { getDb } from '../data/arango.js';

const router = Router();

const SHARE_SECRET = process.env.FILE_SHARE_SECRET ?? 'sam-share-secret-change-me';
const COLLECTION = 'files';

interface FileDto {
  fileId: string;
  channelId: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: number;
  shareUrl?: string;
}

async function listAllFiles(limit = 100): Promise<FileRecord[]> {
  await ensureFilesCollection();
  const db = getDb();
  const cursor = await db.query(
    `FOR f IN ${COLLECTION} SORT f.createdAt DESC LIMIT @limit RETURN f`,
    { limit },
  );
  return (await cursor.all()) as FileRecord[];
}

// GET /api/v1/admin/files
router.get('/files', async (_req, res) => {
  try {
    const files = await listAllFiles(100);
    const tokenMod = await import('../lib/shareToken.js');
    const list: FileDto[] = files.map((f) => {
      const token = tokenMod.createShareToken({
        fileId: f.fileId,
        channelId: f.channelId,
        expiresInSec: 7 * 24 * 3600,
        secret: SHARE_SECRET,
      });
      return {
        fileId: f.fileId,
        channelId: f.channelId,
        filename: f.filename,
        contentType: f.contentType,
        size: f.size,
        createdAt: f.createdAt,
        shareUrl: `/api/v1/files/share/${token}`,
      };
    });
    res.json({ data: list, count: list.length });
  } catch (e) {
    logger.error('admin.files.list.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// DELETE /api/v1/admin/files/:fileId — admin delete file
router.delete('/files/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const file = await findFileByKey(fileId);
    if (!file) {
      return res.status(404).json({ error: 'file not found' });
    }
    const storage = getFileStorage();
    await storage.delete(file.storageKey).catch(() => {});
    await deleteFileRecord(fileId, file.channelId);
    logger.info('admin.files.deleted', { fileId, channelId: file.channelId });
    res.json({ data: { deleted: true } });
  } catch (e) {
    logger.error('admin.files.delete.failed', { error: String(e) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;