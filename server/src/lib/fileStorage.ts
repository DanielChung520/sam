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

  constructor(client?: SeaweedFsClient) {
    this.client = client ?? getSeaweedFsClient();
  }

  async put(key: string, content: Buffer, contentType: string): Promise<{ size: number }> {
    await this.client.ensureBucket();
    const r = await this.client.putObject(key, content, contentType);
    return { size: r.size };
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string }> {
    return this.client.getObject(key);
  }

  async delete(key: string): Promise<void> {
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