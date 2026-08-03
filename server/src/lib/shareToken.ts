// Share token: HMAC-SHA256 + expiry
//
// format: base64url(payload).base64url(signature)
// payload = { fileId, channelId, expiresAt }

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ShareTokenPayload {
  fileId: string;
  channelId: string;
  expiresAt: number;
}

export interface CreateTokenOptions {
  fileId: string;
  channelId: string;
  expiresInSec: number;
  secret: string;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = (4 - (s.length % 4)) % 4;
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
}

function sign(payload: string, secret: string): string {
  return b64urlEncode(createHmac('sha256', secret).update(payload).digest());
}

export function createShareToken(opts: CreateTokenOptions): string {
  const payload: ShareTokenPayload = {
    fileId: opts.fileId,
    channelId: opts.channelId,
    expiresAt: Math.floor(Date.now() / 1000) + opts.expiresInSec,
  };
  const payloadStr = b64urlEncode(Buffer.from(JSON.stringify(payload)));
  return `${payloadStr}.${sign(payloadStr, opts.secret)}`;
}

export interface VerifyTokenOptions {
  token: string;
  secret: string;
}

export function verifyShareToken(opts: VerifyTokenOptions): ShareTokenPayload | null {
  const parts = opts.token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;
  const expectedSig = sign(payloadStr, opts.secret);

  const sigBuf = Buffer.from(sig);
  const expectedSigBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedSigBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedSigBuf)) return null;

  let payload: ShareTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadStr).toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload.fileId !== 'string' || typeof payload.channelId !== 'string' || typeof payload.expiresAt !== 'number') {
    return null;
  }
  if (payload.expiresAt < Math.floor(Date.now() / 1000)) return null;

  return payload;
}