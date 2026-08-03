// Media Service — LINE 多媒體訊息下載與儲存
//
// 職責：
//   1. 用 LINE Messaging API 下載 image/audio/video/file 內容（getMessageContent）
//   2. 存入 SeaweedFS / LocalFS（透過 fileStorage）
//   3. 寫 ArangoDB files collection（channelId 隔離）
//   4. 回傳 mediaUrl / storageKey 供 pipeline / skill 使用
//
// 目前狀態：架構完成，OCR / STT / 檔案解析 為預留介面（見下方 TODO）。

import type { Readable } from 'node:stream';
import { messagingApi } from '@line/bot-sdk';
import { getFileStorage } from '../lib/fileStorage.js';
import { createFileRecord, ensureFilesCollection } from '../data/filesRepo.js';
import { logger } from './logger.js';

export type BlobClient = messagingApi.MessagingApiBlobClient;

export type MediaType = 'image' | 'video' | 'audio' | 'file' | 'sticker';

export interface MediaPayload {
  mediaType: MediaType;
  messageId: string;
  fileName?: string;      // file 訊息才有
  fileSize?: number;      // file 訊息才有
  durationMs?: number;    // audio/video 才有
  contentProvider?: unknown;
}

export interface MediaDownloadResult {
  storageKey: string;      // fileStorage key（channelId/media/{uuid}.{ext}）
  fileName: string;
  contentType: string;
  size: number;
  fileId: string;          // ArangoDB files collection _key/fileId
  messageId: string;
}

// ─── 副檔名推導 ─────────────────────────────────────────────

function extForType(mediaType: MediaType, fileName?: string): string {
  if (fileName) {
    const m = fileName.match(/\.([a-zA-Z0-9]+)$/);
    if (m) return m[1].toLowerCase();
  }
  switch (mediaType) {
    case 'image': return 'jpg';
    case 'video': return 'mp4';
    case 'audio': return 'm4a';
    default: return 'bin';
  }
}

// ─── 下載 + 儲存 ────────────────────────────────────────────

export async function downloadAndStoreMedia(
  client: BlobClient,
  channelId: string,
  ownerUserId: string,
  payload: MediaPayload,
): Promise<MediaDownloadResult> {
  await ensureFilesCollection();

  const stream: Readable = await client.getMessageContent(payload.messageId);
  const buffer = await streamToBuffer(stream);

  const ext = extForType(payload.mediaType, payload.fileName);
  const storageKey = `media/${channelId}/${Date.now()}-${payload.messageId.slice(0, 12)}.${ext}`;
  const contentType = contentTypeFor(payload.mediaType, ext);

  const storage = getFileStorage();
  const { size } = await storage.put(storageKey, buffer, contentType);

  const fileName = payload.fileName ?? `${payload.messageId}.${ext}`;
  const record = await createFileRecord({
    channelId,
    ownerUserId,
    storageKey,
    filename: fileName,
    contentType,
    size,
    metadata: {
      source: 'line-message',
      mediaType: payload.mediaType,
      messageId: payload.messageId,
      durationMs: payload.durationMs,
    },
  });

  logger.info('media.stored', {
    channelId,
    mediaType: payload.mediaType,
    size,
    storageKey,
    fileId: record.fileId,
  });

  return {
    storageKey,
    fileName,
    contentType,
    size,
    fileId: record.fileId,
    messageId: payload.messageId,
  };
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function contentTypeFor(mediaType: MediaType, ext: string): string {
  if (mediaType === 'image') return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  if (mediaType === 'video') return 'video/mp4';
  if (mediaType === 'audio') return `audio/${ext === 'm4a' ? 'mp4' : ext}`;
  return 'application/octet-stream';
}

// ─── 預留介面：OCR / STT / 檔案解析 ─────────────────────────
//
// 環境就緒後實作：
//   - OCR:      dllm Qwen2.5-VL-7B-Instruct（Vlm，需先修 vLLM 引擎）
//   - STT:      dllm 尚無 ASR 模型，需外部方案（Whisper 等）
//   - 檔案解析: 安裝 pdf-parse / mammoth 等依賴後實作

export interface OcrResult {
  kind: 'business_card' | 'greeting_card' | 'other';
  text?: string;
  structured?: Record<string, string>;
}

export async function ocrImage(_client: BlobClient, _storageKey: string): Promise<OcrResult> {
  // TODO: dllm VL 引擎修復後，下載圖片 → 送 Qwen2.5-VL-7B-Instruct 分類
  return { kind: 'other' };
}

export async function transcribeAudio(_client: BlobClient, _storageKey: string): Promise<string> {
  // TODO: ASR 模型/服務就緒後，語音 → 文字
  return '';
}

export async function parseDocument(_client: BlobClient, _storageKey: string, _fileName: string): Promise<string> {
  // TODO: 安裝 pdf-parse / mammoth 後，PDF/Word → 純文字
  return '';
}
