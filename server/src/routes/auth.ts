import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { findAccountByUsername, verifyPassword, upsertAccount } from '../data/accountRepo.js';
import { listChannelsByOwner } from '../data/channelRepo.js';
import { logger } from '../agent/logger.js';

const router = Router();

// In-memory user store (will be replaced with DB later)
const users: Record<string, { id: string; name: string; avatar: string; channels: string[] }> = {};

// 客戶（業務員）登入：username/password → JWT（含 businessOwnerId + channelIds）
router.post('/business-login', async (req: any, res: any) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  try {
    const account = await findAccountByUsername(username);
    if (!account || !account.enabled) {
      return res.status(401).json({ error: '帳號不存在或已停用' });
    }
    if (!account.passwordHash || !verifyPassword(password, account.passwordHash)) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }
    // 動態查詢該業務員名下的 channels（單一真相：channels.businessOwnerId）
    const ownerChannels = await listChannelsByOwner(account.businessOwnerId).catch(() => []);
    const channelIds = ownerChannels.map((c) => c._key);
    const token = jwt.sign(
      { sub: account._key, businessOwnerId: account.businessOwnerId, channelIds, role: 'business' },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );
    // 更新最新登錄時間
    try {
      await upsertAccount({
        _key: account._key,
        name: account.name,
        email: account.email,
        username: account.username,
        passwordHash: account.passwordHash,
        phone: account.phone,
        role: account.role,
        businessOwnerId: account.businessOwnerId,
        channelIds,
        enabled: account.enabled,
        source: account.source,
        lastLoginAt: Date.now(),
      });
    } catch (e) {
      logger.warn('auth.last_login_update_failed', { account: account._key, error: String(e) });
    }
    logger.info('auth.business_login', { account: account._key });
    res.json({
      token,
      user: {
        id: account._key,
        name: account.name,
        email: account.email,
        businessOwnerId: account.businessOwnerId,
        channelIds,
        lastLoginAt: Date.now(),
      },
    });
  } catch (e) {
    logger.error('auth.business_login.failed', { error: String(e) });
    res.status(500).json({ error: '登入失敗，請稍後再試' });
  }
});

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
router.get('/me', async (req: any, res: any) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(
      auth.slice(7),
      process.env.JWT_SECRET || 'dev-secret'
    ) as { sub: string; businessOwnerId?: string; channelIds?: string[]; role?: string };

    // 業務員（DB 帳號）：查 business_accounts
    if (payload.role === 'business' || payload.businessOwnerId) {
      const account = await findAccountByUsername(payload.sub);
      if (!account || !account.enabled) {
        return res.status(401).json({ error: '帳號不存在或已停用' });
      }
      const ownerChannels = await listChannelsByOwner(account.businessOwnerId).catch(() => []);
      return res.json({
        user: {
          id: account._key,
          name: account.name,
          email: account.email,
          businessOwnerId: account.businessOwnerId,
          channelIds: ownerChannels.map((c) => c._key),
        },
      });
    }

    // 舊 dev flow：in-memory users
    const user = users[payload.sub];
    if (!user) return res.status(401).json({ error: 'User not found' });

    res.json({ user });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
