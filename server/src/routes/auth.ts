import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// In-memory user store (will be replaced with DB later)
const users: Record<string, { id: string; name: string; avatar: string; channels: string[] }> = {};

// Temporary: auto-login for development
router.post('/login', (req: any, res: any) => {
  const { channelId, userId, name, avatar } = req.body;

  if (!channelId) {
    return res.status(400).json({ error: 'channelId required' });
  }

  // Find or create user
  const userIdKey = userId || channelId;
  if (!users[userIdKey]) {
    users[userIdKey] = {
      id: userIdKey,
      name: name || '管理員',
      avatar: avatar || '',
      channels: [channelId],
    };
  }

  const user = users[userIdKey];
  const token = jwt.sign(
    { sub: user.id, channelId },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );

  res.json({ token, user });
});

// Verify token and return user
router.get('/me', (req: any, res: any) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(
      auth.slice(7),
      process.env.JWT_SECRET || 'dev-secret'
    ) as { sub: string };

    const user = users[payload.sub];
    if (!user) return res.status(401).json({ error: 'User not found' });

    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
