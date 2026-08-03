// Contacts API — 好友列表/詳情/訊息（ArangoDB 真實資料）
//
// 多租戶：每個請求帶 channelId（業務員的 LINE channel），只回該 channel 的好友。
// 資料來源：webhook 事件累積（contactRepo）+ 訊息（messageRepo）

import { Router } from 'express';
import { listContactsByChannel, findContact, updateContactProfile, type Contact } from '../data/contactRepo.js';
import { listMessages } from '../data/messageRepo.js';
import { logger } from '../agent/logger.js';

const router = Router();

function getChannelId(req: any): string | undefined {
  const q = req.query?.channelId;
  if (typeof q === 'string' && q) return q;
  const k = req.query?.channelKey;
  if (typeof k === 'string' && k) return k;
  const h = req.headers?.['x-channel-id'];
  if (typeof h === 'string' && h) return h;
  return undefined;
}

function toDto(c: Contact): Record<string, unknown> {
  return {
    id: c.userId,                 // 用 LINE userId 當 id（取代 mock 的數字 id）
    name: c.displayName,
    title: c.title ?? '',
    nickname: c.nickname ?? '',
    honorific: c.honorific ?? '',
    salutation: c.salutation ?? '',
    gender: c.gender ?? '',
    birthday: c.birthday ?? '',
    ageGroup: c.ageGroup ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    company: c.company ?? '',
    address: c.address ?? '',
    remark: c.remark ?? '',
    score: c.score ?? 0,
    tags: c.tags ?? [],
    avatar: c.pictureUrl ?? '',
    lastMessage: '',
    lastMessageTime: '',
    unreadCount: c.unreadCount ?? 0,
    messageCount7d: 0,
    replySeconds: 0,
    proactiveCount: 0,
    turnCount: 0,
    badge: getScoreBadge(c.score ?? 0),
  };
}

// GET /api/v1/contacts?channelId=xxx - 好友列表
router.get('/', async (req: any, res) => {
  const channelId = getChannelId(req);
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  try {
    const contacts = await listContactsByChannel(channelId);
    const { tag, search } = req.query;
    let result = contacts;
    if (tag && typeof tag === 'string') {
      result = result.filter((c) => (c.tags ?? []).includes(tag));
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      result = result.filter((c) => c.displayName.toLowerCase().includes(q));
    }
    res.json({ data: result.map(toDto) });
  } catch (e) {
    logger.error('contacts.list.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/v1/contacts/:id?channelId=xxx - 好友詳情
router.get('/:id', async (req: any, res) => {
  const channelId = getChannelId(req);
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  const userId = req.params.id;
  try {
    const contact = await findContact(channelId, userId);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json({ data: toDto(contact) });
  } catch (e) {
    logger.error('contacts.get.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// PATCH /api/v1/contacts/:id?channelId=xxx - 編輯好友資料（聯絡資訊/稱謂/備註/分類標記）
router.patch('/:id', async (req: any, res) => {
  const channelId = getChannelId(req);
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  const userId = req.params.id;
  const {
    title, nickname, honorific, salutation, gender, birthday, ageGroup,
    phone, email, company, address, remark, tags,
    displayName, pictureUrl, statusMessage,
  } = req.body ?? {};
  try {
    const existing = await findContact(channelId, userId);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    await updateContactProfile(channelId, userId, {
      displayName,
      pictureUrl,
      statusMessage,
      title,
      nickname,
      honorific,
      salutation,
      gender,
      birthday,
      ageGroup,
      phone,
      email,
      company,
      address,
      remark,
      tags: Array.isArray(tags) ? tags : undefined,
    });
    const updated = await findContact(channelId, userId);
    res.json({ data: updated ? toDto(updated) : null });
  } catch (e) {
    logger.error('contacts.patch.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/v1/contacts/:id/messages?channelId=xxx - 對話訊息
router.get('/:id/messages', async (req: any, res) => {
  const channelId = getChannelId(req);
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  const userId = req.params.id;
  try {
    const messages = await listMessages(channelId, userId, 100);
    // 轉成 client 預期的格式（昇冪：舊→新）
    const formatted = [...messages].reverse().map((m) => ({
      id: m._key,
      senderId: m.direction === 'in' ? m.userId : 'me',
      text: m.text ?? '',
      time: new Date(m.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      type: m.type === 'text' ? 'text' : 'image',
    }));
    res.json({ data: formatted });
  } catch (e) {
    logger.error('contacts.messages.failed', { error: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

function getScoreBadge(score: number): { emoji: string; label: string; color: string } {
  if (score >= 80) return { emoji: '🔥🔥', label: '高熱度', color: '#EF4444' };
  if (score >= 50) return { emoji: '🔥', label: '中等', color: '#F97316' };
  if (score >= 10) return { emoji: '🌱', label: '低', color: '#10B981' };
  return { emoji: '💤', label: '沉睡', color: '#94A3B8' };
}

export default router;
