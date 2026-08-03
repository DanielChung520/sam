// Channels API（業務員用）— 列出目前登入帳號名下的 LINE 分身
//
// 多租戶：業務員可代管多個 LINE 分身（channel），
// 登入後以 JWT 的 businessOwnerId 查詢名下 channels，供 app 切換「主身帳號」。

import { Router } from 'express';
import { listChannelsByOwner } from '../data/channelRepo.js';
import { getBusinessOwnerId } from '../lib/authJwt.js';
import { logger } from '../agent/logger.js';

const router = Router();

// GET /api/v1/channels/mine — 目前帳號名下的 channels（不含 secret/token）
router.get('/mine', async (req: any, res: any) => {
  const ownerId = getBusinessOwnerId(req);
  if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const channels = await listChannelsByOwner(ownerId);
    const data = channels
      .filter((c) => c.enabled !== false)
      .map((c) => ({
        key: c._key,
        name: c.name,
        avatar: c.avatar ?? '',
        destination: c.destination ?? '',
      }));
    res.json({ data });
  } catch (e) {
    logger.error('channels.mine.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

export default router;
