// SeaweedFS S3 client (uses AWS SigV4 signing)
//
// filer port 8333 暴露 S3 gateway。允許匿名 bucket 創建。
// 但 PUT object 需要 AWS SigV4 signature。

import { createHash, createHmac } from 'node:crypto';

export interface SeaweedFsConfig {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export const DefaultSeaweedFsConfig: SeaweedFsConfig = {
  endpoint: process.env.SEAWEEDFS_ENDPOINT ?? 'http://localhost:8333',
  region: process.env.SEAWEEDFS_REGION ?? 'us-east-1',
  accessKey: process.env.SEAWEEDFS_ACCESS_KEY ?? 'anonymous',
  secretKey: process.env.SEAWEEDFS_SECRET_KEY ?? 'anonymous',
  bucket: process.env.SEAWEEDFS_BUCKET ?? 'sam-files',
};

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}
function hmacHex(key: Buffer | string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}
function toAmzDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

interface SignOptions {
  method: 'PUT' | 'GET' | 'DELETE';
  path: string;
  bodyHash: string;
  contentType?: string;
}

function signRequest(cfg: SeaweedFsConfig, opts: SignOptions): Record<string, string> {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);

  const host = new URL(cfg.endpoint).host;
  const canonicalHeaders = `host:${host}\n` +
    (opts.contentType ? `x-amz-content-sha256:${opts.bodyHash}\n` : '') +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = opts.contentType ? 'host;x-amz-content-sha256;x-amz-date' : 'host;x-amz-date';

  const canonicalRequest = [
    opts.method,
    opts.path,
    '',
    canonicalHeaders,
    signedHeaders,
    opts.bodyHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${cfg.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmacHex(kSigning, stringToSign);

  const authHeader = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    Host: host,
    'X-Amz-Date': amzDate,
    Authorization: authHeader,
  };
  if (opts.contentType) {
    headers['Content-Type'] = opts.contentType;
    headers['x-amz-content-sha256'] = opts.bodyHash;
  }
  return headers;
}

export class SeaweedFsClient {
  private readonly cfg: SeaweedFsConfig;

  constructor(cfg?: SeaweedFsConfig) {
    this.cfg = cfg ?? DefaultSeaweedFsConfig;
  }

  get endpoint(): string {
    return this.cfg.endpoint;
  }
  get bucket(): string {
    return this.cfg.bucket;
  }

  async ensureBucket(): Promise<void> {
    const url = `${this.cfg.endpoint}/${this.cfg.bucket}`;
    const bodyHash = sha256('');
    const headers = signRequest(this.cfg, { method: 'PUT', path: `/${this.cfg.bucket}`, bodyHash });
    const res = await fetch(url, { method: 'PUT', headers });
    if (!res.ok && res.status !== 409) {
      throw new Error(`ensureBucket ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  }

  async putObject(key: string, content: Buffer | string, contentType = 'application/octet-stream'): Promise<{ etag: string; size: number }> {
    const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    const bodyHash = sha256(buf);
    const path = `/${this.cfg.bucket}/${key}`;
    const url = `${this.cfg.endpoint}${path}`;
    const headers = signRequest(this.cfg, { method: 'PUT', path, bodyHash, contentType });
    const res = await fetch(url, { method: 'PUT', headers, body: buf });
    if (!res.ok) {
      throw new Error(`putObject ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const etag = res.headers.get('ETag')?.replace(/"/g, '') ?? '';
    return { etag, size: buf.length };
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
    const path = `/${this.cfg.bucket}/${key}`;
    const url = `${this.cfg.endpoint}${path}`;
    const bodyHash = sha256('');
    const headers = signRequest(this.cfg, { method: 'GET', path, bodyHash });
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      throw new Error(`getObject ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const ab = await res.arrayBuffer();
    return { body: Buffer.from(ab), contentType: res.headers.get('Content-Type') ?? 'application/octet-stream' };
  }

  async deleteObject(key: string): Promise<void> {
    const path = `/${this.cfg.bucket}/${key}`;
    const url = `${this.cfg.endpoint}${path}`;
    const bodyHash = sha256('');
    const headers = signRequest(this.cfg, { method: 'DELETE', path, bodyHash });
    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      throw new Error(`deleteObject ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  }
}

let _client: SeaweedFsClient | null = null;
export function getSeaweedFsClient(cfg?: SeaweedFsConfig): SeaweedFsClient {
  if (!_client) _client = new SeaweedFsClient(cfg);
  return _client;
}
export function resetSeaweedFsClient(): void {
  _client = null;
}