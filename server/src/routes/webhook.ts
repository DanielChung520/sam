import { Router } from 'express';

const router = Router();

router.post('/', (req: any, res: any) => {
  const events = req.body?.events || [];

  for (const event of events) {
    console.log('LINE event:', event.type, event.source?.userId);

    if (event.type === 'message') {
      // TODO: handle message events
    } else if (event.type === 'follow') {
      // New friend added
    } else if (event.type === 'unfollow') {
      // Friend removed
    }
  }

  res.status(200).end();
});

router.get('/health', (_req: any, res: any) => {
  res.json({ ok: true });
});

export default router;
