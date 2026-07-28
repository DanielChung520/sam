import { Router } from 'express';
import { greetingTemplates, news, usbStatus } from '../data/mock.js';

const router = Router();

// GET /api/v1/greetings - 賀卡樣板列表
router.get('/greetings', (req, res) => {
  const { category } = req.query;
  let result = [...greetingTemplates];
  if (category && typeof category === 'string') {
    result = result.filter(g => g.category === category);
  }
  res.json({ data: result });
});

// GET /api/v1/news - 新聞列表
router.get('/news', (req, res) => {
  const { category } = req.query;
  let result = [...news];
  if (category && typeof category === 'string' && category !== '全部') {
    result = result.filter(n => n.category === category);
  }
  res.json({ data: result });
});

// GET /api/v1/usb/status - USB 狀態
router.get('/usb/status', (req, res) => {
  res.json({ data: usbStatus });
});

export default router;
