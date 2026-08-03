// File storage abstraction
//
// 在 host infra 還沒把 SeaweedFS 配好時，先 fallback 到本地 FS。
// Production 設定 SEAWEEDFS_ENDPOINT 就會走 S3。

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getSeaweedFsClient, type SeaweedFsClient } from './seaweedFs.js';

export interface FileStorage {
  put(key: string, content: Buffer, contentType: string): Promise<{ size: number }>;
  get(key: string): Promise<{ body: Buffer; contentType: string }>;
  delete(key: string): Promise<void>;
}

export class LocalFsStorage implements FileStorage {
  private readonly root: string;

  constructor(root?: string) {
    this.root = root ?? process.env.FILE_STORAGE_ROOT ?? '/tmp/sam-files';
  }

  async put(key: string, content: Buffer, _contentType: string): Promise<{ size: number }> {
    const path = join(this.root, key);
    await fs.mkdir(join(this.root, ...key.split('/').slice(0, -1)), { recursive: true });
    await fs.writeFile(path, content);
    return { size: content.length };
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string }> {
    const path = join(this.root, key);
    const body = await fs.readFile(path);
    return { body, contentType: 'application/octet-stream' };
  }

  async delete(key: string): Promise<void> {
    const path = join(this.root, key);
    await fs.unlink(path).catch(() => {});
  }
}

export class SeaweedFsStorage implements FileStorage {
  private readonly client: SeaweedFsClient;
  private readonly filerEndpoint: string;

  constructor(client?: SeaweedFsClient) {
    this.client = client ?? getSeaweedFsClient();
    this.filerEndpoint = process.env.SEAWEEDFS_FILER_ENDPOINT ?? 'http://localhost:8888';
  }

  // 優先走 Filer HTTP API（PUT/GET/DELETE /bucket/key），失敗才退回 S3 client
  async put(key: string, content: Buffer, contentType: string): Promise<{ size: number }> {
    const url = `${this.filerEndpoint}/${this.client.bucket}/${key}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: content,
    });
    if (res.ok || res.status === 201) {
      return { size: content.length };
    }
    await this.client.ensureBucket();
    const r = await this.client.putObject(key, content, contentType);
    return { size: r.size };
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string }> {
    const url = `${this.filerEndpoint}/${this.client.bucket}/${key}`;
    const res = await fetch(url);
    if (res.ok) {
      const ab = await res.arrayBuffer();
      return { body: Buffer.from(ab), contentType: res.headers.get('Content-Type') ?? 'application/octet-stream' };
    }
    return this.client.getObject(key);
  }

  async delete(key: string): Promise<void> {
    const url = `${this.filerEndpoint}/${this.client.bucket}/${key}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (res.ok || res.status === 204 || res.status === 404) return;
    await this.client.deleteObject(key);
  }
}

let _storage: FileStorage | null = null;

export function getFileStorage(): FileStorage {
  if (_storage) return _storage;
  const useSeaweed = process.env.SEAWEEDFS_ENDPOINT && process.env.STORAGE_BACKEND !== 'local';
  _storage = useSeaweed ? new SeaweedFsStorage() : new LocalFsStorage();
  return _storage;
}

export function resetFileStorage(): void {
  _storage = null;
}