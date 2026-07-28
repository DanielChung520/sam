import { Router } from 'express';
import { broadcasts } from '../data/mock.js';

const router = Router();

// GET /api/v1/broadcasts - 群發任務列表
router.get('/', (req, res) => {
  res.json({ data: broadcasts });
});

// POST /api/v1/broadcasts - 建立群發任務
router.post('/', (req, res) => {
  const { title, contactIds, template } = req.body;
  if (!title || !contactIds || !template) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const newBroadcast = {
    id: broadcasts.length + 1,
    title,
    status: 'scheduled' as const,
    total: contactIds.length,
    sent: 0,
    createdAt: new Date().toISOString().split('T')[0],
    scheduledAt: '2026-08-01 09:00',
    template,
  };
  broadcasts.push(newBroadcast);
  res.json({ data: newBroadcast });
});

export default router;
