// Chats API — 對話列表/詳情/發送（ArangoDB 真實資料）
//
// 多租戶：每個請求帶 channelId。資料來源：messageRepo（webhook 累積）

import { Router } from 'express';
import { listContactsByChannel } from '../data/contactRepo.js';
import { listMessages, createMessage, listLastMessagesByChannel } from '../data/messageRepo.js';
import { logger } from '../agent/logger.js';

const router = Router();

function getChannelId(req: any): string | undefined {
  const q = req.query?.channelId;
  if (typeof q === 'string' && q) return q;
  const h = req.headers?.['x-channel-id'];
  if (typeof h === 'string' && h) return h;
  return undefined;
}

function getScoreBadge(score: number): { emoji: string; label: string; color: string } {
  if (score >= 80) return { emoji: '🔥🔥', label: '高熱度', color: '#EF4444' };
  if (score >= 50) return { emoji: '🔥', label: '中等', color: '#F97316' };
  if (score >= 10) return { emoji: '🌱', label: '低', color: '#10B981' };
  return { emoji: '💤', label: '沉睡', color: '#94A3B8' };
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

router.get('/', async (req: any, res) => {
  const channelId = getChannelId(req);
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  try {
    const [contacts, lastMsgs] = await Promise.all([
      listContactsByChannel(channelId),
      listLastMessagesByChannel(channelId),
    ]);
    const list = contacts
      .filter((c) => lastMsgs[c.userId])
      .map((c) => {
        const last = lastMsgs[c.userId];
        return {
          id: c.userId,
          name: c.displayName,
          avatar: c.pictureUrl ?? '',
          lastMessage: last?.text ?? '',
          lastMessageTime: last ? fmtTime(last.createdAt) : '',
          unreadCount: c.unreadCount ?? 0,
          score: c.score ?? 0,
          badge: getScoreBadge(c.score ?? 0),
        };
      })
      .sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        return 0;
      });
    res.json({ data: list });
  } catch (e) {
    logger.error('chats.list.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:id', async (req: any, res) => {
  const channelId = getChannelId(req);
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  const userId = req.params.id;
  try {
    const [contacts, messages] = await Promise.all([
      listContactsByChannel(channelId),
      listMessages(channelId, userId, 100),
    ]);
    const contact = contacts.find((c) => c.userId === userId);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    const formatted = [...messages].reverse().map((m) => ({
      id: m._key,
      senderId: m.direction === 'in' ? m.userId : 'me',
      text: m.text ?? '',
      time: fmtTime(m.createdAt),
      type: m.type === 'text' ? 'text' : 'image',
    }));
    res.json({
      data: {
        contact: {
          id: contact.userId,
          name: contact.displayName,
          avatar: contact.pictureUrl ?? '',
          title: '',
          company: '',
          score: contact.score ?? 0,
          badge: getScoreBadge(contact.score ?? 0),
        },
        messages: formatted,
      },
    });
  } catch (e) {
    logger.error('chats.get.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

router.post('/:id/messages', async (req: any, res) => {
  const channelId = getChannelId(req);
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  const userId = req.params.id;
  const { text } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const msg = await createMessage({ channelId, userId, direction: 'out', type: 'text', text });
    res.json({
      data: {
        id: msg._key,
        senderId: 'me',
        text,
        time: fmtTime(msg.createdAt),
        type: 'text',
      },
    });
  } catch (e) {
    logger.error('chats.post.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

export default router;
