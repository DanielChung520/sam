// Chats API — 對話列表/詳情/發送（ArangoDB 真實資料）
//
// 多租戶：預設每個請求帶 channelId（x-channel-id）只回該 channel。
// 若未帶 channelId 且帶業務員 JWT，則合併名下所有 channels 的聊天，
// 每筆標記 channelKey/channelName，供 app 用右側色條區別主身帳號。

import { Router } from 'express';
import { listContactsByChannel } from '../data/contactRepo.js';
import { listChannelsByOwner } from '../data/channelRepo.js';
import { listMessages, createMessage, listLastMessagesByChannel } from '../data/messageRepo.js';
import { getChannelId, getBusinessOwnerId } from '../lib/authJwt.js';
import { logger } from '../agent/logger.js';

const router = Router();

// 主身帳號色條色盤（依 channel 順序輪替）
const CHANNEL_COLORS = ['#059669', '#F97316', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

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

  // 合併模式：未指定 channel → 查名下所有 channels
  let channelsToLoad: { key: string; name: string; color: string; destination?: string }[] = [];
  if (channelId) {
    channelsToLoad = [{ key: channelId, name: '', color: CHANNEL_COLORS[0] }];
  } else {
    const ownerId = getBusinessOwnerId(req);
    if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const owned = await listChannelsByOwner(ownerId);
      channelsToLoad = owned
        .filter((c) => c.enabled !== false)
        .map((c, i) => ({
          key: c._key,
          name: c.name,
          color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
          destination: c.destination,
        }));
    } catch (e) {
      logger.error('chats.ownerChannels.failed', { error: String(e) });
      return res.status(500).json({ error: String(e) });
    }
  }

  try {
    const list: Record<string, unknown>[] = [];
    for (const ch of channelsToLoad) {
      const [contacts, lastMsgs] = await Promise.all([
        listContactsByChannel(ch.key),
        listLastMessagesByChannel(ch.key),
      ]);
      for (const c of contacts) {
        const last = lastMsgs[c.userId];
        if (!last) continue;
        list.push({
          id: c.userId,
          name: c.displayName,
          avatar: c.pictureUrl ?? '',
          lastMessage: last?.text ?? '',
          lastMessageTime: last ? fmtTime(last.createdAt) : '',
          unreadCount: c.unreadCount ?? 0,
          score: c.score ?? 0,
          badge: getScoreBadge(c.score ?? 0),
          channelKey: ch.key,
          channelName: ch.name,
          channelColor: ch.color,
          // 主身本人：userId == channel destination（業務員自己加了自己的分身）
          isPrimary: !!ch.destination && c.userId === ch.destination,
        });
      }
    }
    list.sort((a: any, b: any) => {
      // 主身本人置頂，再依 unread > 0 排序
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
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
