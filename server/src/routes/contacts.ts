import { Router } from 'express';
import { contacts, chatMessages } from '../data/mock.js';

const router = Router();

// GET /api/v1/contacts - 好友列表
router.get('/', (req, res) => {
  const { tag, search } = req.query;
  let result = [...contacts];

  if (tag && typeof tag === 'string') {
    result = result.filter(c => c.tags.includes(tag));
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    result = result.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q)
    );
  }

  // 計算積分徽章
  const withBadges = result.map(c => ({
    ...c,
    badge: getScoreBadge(c.score),
  }));

  res.json({ data: withBadges });
});

// GET /api/v1/contacts/:id - 好友詳情
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const contact = contacts.find(c => c.id === id);
  if (!contact) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }
  res.json({
    data: {
      ...contact,
      badge: getScoreBadge(contact.score),
    },
  });
});

// PATCH /api/v1/contacts/:id - 更新積分
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const contact = contacts.find(c => c.id === id);
  if (!contact) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }
  const { score, tags } = req.body;
  if (score !== undefined) contact.score = score;
  if (tags !== undefined) contact.tags = tags;
  res.json({ data: { ...contact, badge: getScoreBadge(contact.score) } });
});

// GET /api/v1/contacts/:id/messages - 對話訊息
router.get('/:id/messages', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const messages = chatMessages[id] || [];
  res.json({ data: messages });
});

function getScoreBadge(score: number): { emoji: string; label: string; color: string } {
  if (score >= 80) return { emoji: '🔥🔥', label: '高熱度', color: '#EF4444' };
  if (score >= 50) return { emoji: '🔥', label: '中等', color: '#F97316' };
  if (score >= 10) return { emoji: '🌱', label: '低', color: '#10B981' };
  return { emoji: '💤', label: '沉睡', color: '#94A3B8' };
}

export default router;
