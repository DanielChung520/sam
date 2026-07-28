import { Router } from 'express';
import { contacts, chatMessages } from '../data/mock.js';

const router = Router();

// GET /api/v1/chats - 對話列表
router.get('/', (req, res) => {
  const chatList = contacts
    .filter(c => chatMessages[c.id] && chatMessages[c.id].length > 0)
    .map(c => {
      const msgs = chatMessages[c.id];
      const lastMsg = msgs[msgs.length - 1];
      return {
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        lastMessage: lastMsg.text,
        lastMessageTime: lastMsg.time,
        unreadCount: c.unreadCount,
        score: c.score,
        badge: getScoreBadge(c.score),
      };
    })
    .sort((a, b) => {
      // 有未讀的排前面
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      return 0;
    });

  res.json({ data: chatList });
});

// GET /api/v1/chats/:id - 對話詳情（含好友資訊與訊息）
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const contact = contacts.find(c => c.id === id);
  if (!contact) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }
  const messages = chatMessages[id] || [];
  res.json({
    data: {
      contact: {
        id: contact.id,
        name: contact.name,
        avatar: contact.avatar,
        title: contact.title,
        company: contact.company,
        score: contact.score,
        badge: getScoreBadge(contact.score),
      },
      messages,
    },
  });
});

// POST /api/v1/chats/:id/messages - 發送訊息
router.post('/:id/messages', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { text } = req.body;
  if (!text) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }
  const newMsg = {
    id: Date.now(),
    senderId: 'me' as const,
    text,
    time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    type: 'text' as const,
  };
  if (!chatMessages[id]) chatMessages[id] = [];
  chatMessages[id].push(newMsg);
  res.json({ data: newMsg });
});

function getScoreBadge(score: number): { emoji: string; label: string; color: string } {
  if (score >= 80) return { emoji: '🔥🔥', label: '高熱度', color: '#EF4444' };
  if (score >= 50) return { emoji: '🔥', label: '中等', color: '#F97316' };
  if (score >= 10) return { emoji: '🌱', label: '低', color: '#10B981' };
  return { emoji: '💤', label: '沉睡', color: '#94A3B8' };
}

export default router;
