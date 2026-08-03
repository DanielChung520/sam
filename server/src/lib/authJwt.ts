// JWT helper — 業務員 token 驗證（businessOwnerId 解析）
import jwt from 'jsonwebtoken';

export interface BusinessToken {
  sub: string;
  businessOwnerId?: string;
  channelIds?: string[];
  role?: string;
}

export function getBusinessOwnerId(req: any): string | null {
  const auth = req.headers?.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'dev-secret') as BusinessToken;
    return payload.businessOwnerId ?? payload.sub ?? null;
  } catch {
    return null;
  }
}

export function getChannelId(req: any): string | undefined {
  const q = req.query?.channelId;
  if (typeof q === 'string' && q) return q;
  const k = req.query?.channelKey;
  if (typeof k === 'string' && k) return k;
  const h = req.headers?.['x-channel-id'];
  if (typeof h === 'string' && h) return h;
  return undefined;
}
