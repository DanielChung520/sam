// sam LINE Agent — Response Formatter
//
// 將 skill 輸出格式化為 LINE 訊息：
//   - 字數過長自動分段（LINE 上限 5000 chars/chunk）
//   - 統一前後綴（任務完成標記、執行計畫 ID）

import type { Conversation } from './types.js';

export const LINE_MAX_MESSAGE_LENGTH = 4500;

export interface FormatOptions {
  header?: string;
  footer?: string;
  maxLength?: number;
}

export function formatResponse(raw: string, _conv: Conversation, opts: FormatOptions = {}): string {
  const text = (raw ?? '').toString().trim();
  if (!text) return '（沒有輸出）';

  const header = opts.header ?? '';
  const footer = opts.footer ?? '';
  const max = opts.maxLength ?? LINE_MAX_MESSAGE_LENGTH;

  const composed = [header, text, footer].filter(Boolean).join('\n\n');

  if (composed.length <= max) return composed;
  return truncatePreservingStructure(composed, max);
}

export function chunkForLine(text: string, maxLength = LINE_MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let cutAt = remaining.lastIndexOf('\n\n', maxLength);
    if (cutAt === -1 || cutAt < maxLength * 0.5) {
      cutAt = remaining.lastIndexOf('\n', maxLength);
    }
    if (cutAt === -1 || cutAt < maxLength * 0.5) {
      cutAt = maxLength;
    }
    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export function progressAck(command: string, arg: string): string {
  const preview = arg.length > 30 ? arg.slice(0, 30) + '…' : arg;
  return `處理中：${command}「${preview}」\n（會需要一點時間，完成後我會自動回覆）`;
}

function truncatePreservingStructure(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 100);
  const tail = text.slice(text.length - 50);
  return `${head}\n\n…（已截斷，完整輸出 ${text.length} 字元）…\n\n${tail}`;
}