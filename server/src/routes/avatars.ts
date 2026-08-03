// Avatars API — 頭像清單與靜態檔案服務
//
// 來源：AVATAR_DIR（預設 /home/daniel/github/avatars）
//   GET /api/v1/avatars           → 列出所有頭像檔名
//   GET /api/v1/avatars/:file     → 回傳頭像圖片

import { Router } from 'express';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';

const AVATAR_DIR = process.env.AVATAR_DIR || '/home/daniel/github/avatars';
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

const router = Router();

router.get('/avatars', async (_req, res) => {
  try {
    const files = await fs.readdir(AVATAR_DIR);
    const avatars = files
      .filter((f) => ALLOWED_EXT.has(join(f).slice(join(f).lastIndexOf('.'))))
      .map((f) => ({ name: f, url: `/api/v1/avatars/${encodeURIComponent(f)}` }));
    res.json({ data: avatars, total: avatars.length });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.get('/avatars/:file', async (req, res) => {
  const fileName = req.params.file;
  // 防路徑穿越
  if (!ALLOWED_EXT.has(fileName.slice(fileName.lastIndexOf('.')))) {
    return res.status(400).json({ error: 'invalid file type' });
  }
  const filePath = resolve(join(AVATAR_DIR, fileName));
  if (!filePath.startsWith(resolve(AVATAR_DIR))) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const data = await fs.readFile(filePath);
    const ext = fileName.slice(fileName.lastIndexOf('.') + 1);
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(data);
  } catch {
    res.status(404).json({ error: 'avatar not found' });
  }
});

export default router;
