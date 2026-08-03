import { Router } from 'express';
import { messagingApi, validateSignature, webhook } from '@line/bot-sdk';
import { getPolarisPipeline } from '../agent/pipeline.js';
import { getRateLimiter } from '../agent/rateLimiter.js';
import { logger } from '../agent/logger.js';
import { chunkForLine } from '../agent/responseFormatter.js';
import { Metrics } from '../lib/metrics.js';
import { findChannelByDestination, findChannelById, ensureChannelsCollection } from '../data/channelRepo.js';
import type { Channel } from '../data/channelRepo.js';
import { enqueueExtraction } from '../agent/memoryExtractor.js';
import { getConversationStore } from '../agent/stateStore.js';
import { downloadAndStoreMedia, type MediaPayload } from '../agent/mediaService.js';
import { getAgentRegistry } from '../agent/agentRegistry.js';
import { randomUUID } from 'node:crypto';

const L1_WINDOW_SIZE = 50;

type WebhookEvent = webhook.Event;
type ChannelCacheEntry = {
  channel: Channel;
  client: messagingApi.MessagingApiClient;
  blobClient: messagingApi.MessagingApiBlobClient;
  cachedAt: number;
};
const CHANNEL_CACHE_TTL_MS = 60_000;
const channelCache = new Map<string, ChannelCacheEntry>();

let bootChannelCache: messagingApi.MessagingApiClient | null = null;
const BOOT_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

function getBootClient(): messagingApi.MessagingApiClient | null {
  if (!BOOT_ACCESS_TOKEN) return null;
  if (!bootChannelCache) {
    bootChannelCache = new messagingApi.MessagingApiClient({
      channelAccessToken: BOOT_ACCESS_TOKEN,
    });
  }
  return bootChannelCache;
}

function newBlobClient(accessToken: string): messagingApi.MessagingApiBlobClient {
  return new messagingApi.MessagingApiBlobClient({ channelAccessToken: accessToken });
}

async function getClientForChannel(destination: string): Promise<{
  client: messagingApi.MessagingApiClient | null;
  blobClient: messagingApi.MessagingApiBlobClient | null;
  channel: Channel | null;
}> {
  const cached = channelCache.get(destination);
  if (cached && Date.now() - cached.cachedAt < CHANNEL_CACHE_TTL_MS) {
    return { client: cached.client, blobClient: cached.blobClient, channel: cached.channel };
  }
  const channel = await findChannelByDestination(destination);
  if (!channel || !channel.enabled) {
    return { client: null, blobClient: null, channel: null };
  }
  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: channel.accessToken,
  });
  const blobClient = newBlobClient(channel.accessToken);
  channelCache.set(destination, { channel, client, blobClient, cachedAt: Date.now() });
  return { client, blobClient, channel };
}

const router = Router();

// 支援兩種路徑：
//   POST /webhook                    ← 靠 body.destination 查 channel
//   POST /webhook/ch_{key}            ← 靠 URL 的 channel key（LINE 後台設的獨立 webhook）
router.post('/:channelPath?', async (req: any, res: any) => {
  await ensureChannelsCollection();

  const body: any = req.body ?? {};
  const destination: string | undefined = body.destination;
  const events: WebhookEvent[] = body.events || [];
  const channelPath: string | undefined = req.params.channelPath;

  // 從 URL 解析 channel：/webhook/ch_{key} 或 /webhook/{key}
  let urlChannelKey: string | undefined;
  if (channelPath) {
    urlChannelKey = channelPath.startsWith('ch_') ? channelPath.slice(3) : channelPath;
  }

  // 優先用 URL 的 channel key，否則靠 destination
  let channelLookup: { client: messagingApi.MessagingApiClient | null; blobClient: messagingApi.MessagingApiBlobClient | null; channel: Channel | null };
  if (urlChannelKey) {
    const channel = await findChannelById(urlChannelKey);
    if (channel && channel.enabled) {
      const client = new messagingApi.MessagingApiClient({ channelAccessToken: channel.accessToken });
      const blobClient = newBlobClient(channel.accessToken);
      channelLookup = { client, blobClient, channel };
    } else {
      logger.warn('webhook.url_channel_not_found', { urlChannelKey });
      return res.status(200).end();
    }
  } else {
    if (!destination) {
      logger.warn('webhook.missing_destination', { eventCount: events.length });
      return res.status(200).end();
    }
    channelLookup = await getClientForChannel(destination);
  }

  const channelSecret = channelLookup.channel?.channelSecret;

  if (channelSecret) {
    const signature = req.header('x-line-signature') || '';
    const rawBody = (req as any).rawBody;
    if (rawBody) {
      const valid = validateSignature(rawBody, channelSecret, signature);
      if (!valid) {
        logger.warn('webhook.invalid_signature', { destination });
        return res.status(401).json({ error: 'invalid signature' });
      }
    }
  } else {
    logger.warn('webhook.channel_not_registered', { destination });
  }

  res.status(200).end();

  const client = channelLookup.client ?? getBootClient();
  const blobClient = channelLookup.blobClient;
  const channel = channelLookup.channel;
  const channelId = channel?._key ?? urlChannelKey ?? destination ?? 'unknown';
  const businessOwnerId = channel?.businessOwnerId ?? 'unknown';
  const limiter = getRateLimiter();

  // 異步並發佇列：入隊 → 立即回 200 → 背景 worker 處理
  const registry = getAgentRegistry();
  let instance;
  try {
    instance = await registry.get(channelId);
  } catch {
    return res.status(200).end();
  }
  const pool = instance.pool;
  if (!pool.isHandlerSet) {
    pool.setHandler(processQueueItem);
  }

  for (const event of events) {
    const userId = (event as any).source?.userId;
    if (!userId) continue;

    // follow / unfollow 事件 → 更新好友清單
    if (event.type === 'follow' || event.type === 'unfollow') {
      await handleFollowEvent(client, channel, channelId, userId, event.type === 'follow');
      continue;
    }
    // join/leave（群組）暫不處理
    if (event.type === 'join' || event.type === 'leave') continue;

    if (event.type !== 'message') continue;
    const messageEvent = event as any;
    const msgType: string = messageEvent.message?.type ?? '';
    const sourceType: string = (event as any).source?.type ?? 'user';

    // 訊息落庫（真實對話資料）
    await persistIncomingMessage(channelId, userId, messageEvent.message, client).catch((e) =>
      logger.warn('webhook.message_persist_failed', { channelId, userId, error: String(e) })
    );

    if (!shouldRespondByMessage(sourceType, msgType, messageEvent.message, businessOwnerId)) {
      logger.debug('webhook.skipped_group_no_mention', { userId, channelId, sourceType });
      continue;
    }

    Metrics.incMessage();

    const rate = await limiter.check(userId);
    if (!rate.allowed) {
      logger.info('webhook.rate_limited', { userId, channelId, retryAfterSec: rate.retryAfterSec });
      if (client && replyTokenOf(messageEvent)) {
        await safeReply(client, replyTokenOf(messageEvent)!, '訊息頻率過高，請稍候再試 🙏');
      }
      continue;
    }

    const item = {
      id: randomUUID(),
      channelId,
      userId,
      enqueuedAt: Date.now(),
      attempts: 0,
      payload: {
        event: messageEvent,
        sourceType,
        msgType,
        client,
        blobClient,
        channel,
        channelId,
        userId,
        businessOwnerId,
        queuePriority: channel?.queuePriority ?? 0,
      },
    };
    await pool.submit(channelId, item, channel?.concurrencyLimit ?? 2);
  }
});

function replyTokenOf(event: any): string | undefined {
  return event?.replyToken;
}

// follow/unfollow 事件 → 新增/封鎖好友
async function handleFollowEvent(
  client: messagingApi.MessagingApiClient | null,
  channel: Channel | null,
  channelId: string,
  userId: string,
  isFollow: boolean,
): Promise<void> {
  try {
    const { upsertContact, findContact } = await import('../data/contactRepo.js');
    if (isFollow) {
      let displayName = `好友 ${userId.slice(0, 6)}`;
      let pictureUrl: string | undefined;
      if (client) {
        try {
          const profile = await client.getProfile(userId);
          displayName = profile.displayName || displayName;
          pictureUrl = profile.pictureUrl;
        } catch {
          /* getProfile 失敗仍建立 contact */
        }
      }
      await upsertContact({
        channelId,
        userId,
        displayName,
        pictureUrl,
        tags: [],
        score: 0,
        unreadCount: 0,
        isBlocked: false,
        followedAt: Date.now(),
      });
      logger.info('webhook.follow', { channelId, userId, displayName });

      // 新用戶加好友 → 推自我介紹
      if (client) {
        const { buildSelfIntro } = await import('../agent/selfIntro.js');
        const intro = buildSelfIntro(channel?.name);
        await sendPushOnly(client, channel, userId, intro).catch((e) =>
          logger.warn('webhook.follow_intro_failed', { channelId, userId, error: String(e) })
        );
      }
    } else {
      const existing = await findContact(channelId, userId);
      if (existing) {
        await upsertContact({ ...existing, isBlocked: true });
      }
      logger.info('webhook.unfollow', { channelId, userId });
    }
  } catch (e) {
    logger.warn('webhook.follow_event_failed', { channelId, userId, error: String(e) });
  }
}

// 收到的訊息寫入 messages collection
async function persistIncomingMessage(
  channelId: string,
  userId: string,
  message: any,
  client: messagingApi.MessagingApiClient | null,
): Promise<void> {
  const { createMessage } = await import('../data/messageRepo.js');
  const { upsertContact } = await import('../data/contactRepo.js');

  await createMessage({
    channelId,
    userId,
    direction: 'in',
    type: message?.type ?? 'text',
    text: message?.type === 'text' ? (message.text ?? '') : undefined,
    replyToken: undefined,
  });

  // 同時確保 contact 存在（來訊 = 是好友）
  const existing = await (await import('../data/contactRepo.js')).findContact(channelId, userId);
  if (!existing) {
    let displayName = `好友 ${userId.slice(0, 6)}`;
    let pictureUrl: string | undefined;
    if (client) {
      try {
        const profile = await client.getProfile(userId);
        displayName = profile.displayName || displayName;
        pictureUrl = profile.pictureUrl;
      } catch { /* ignore */ }
    }
    await upsertContact({
      channelId,
      userId,
      displayName,
      pictureUrl,
      tags: [],
      score: 0,
      unreadCount: 1,
      isBlocked: false,
      followedAt: Date.now(),
    });
  } else {
    await upsertContact({ ...existing, unreadCount: (existing.unreadCount ?? 0) + 1, lastMessageAt: Date.now() });
  }
}

// 背景 worker：處理一條入隊訊息（text 或 media），回覆用 reply 或 push
async function processQueueItem(item: import('../agent/asyncQueue.js').QueueItem): Promise<void> {
  const p = item.payload as any;
  const { event, msgType, client, blobClient, channel, channelId, userId, businessOwnerId } = p;
  const pipeline = getPolarisPipeline();
  const replyToken = replyTokenOf(event);

  try {
    await triggerSlidingWindowExtraction(userId, channelId);

    if (msgType !== 'text') {
      await handleMediaMessage(client, blobClient, pipeline, userId, channelId, event, p.sourceType, businessOwnerId);
      return;
    }

    const text: string = event.message?.text ?? '';

    // ack：慢任務（taskforge 型 slash 指令）先回「處理中」，完成後再 push 結果
    const isSlowTask = isTaskforgeSlash(text);
    if (isSlowTask && channel?.ackEnabled !== false && client && replyToken) {
      const ackMsg = channel.ackMessage?.trim() || '收到，處理中...';
      await safeReply(client, replyToken, ackMsg);
    }

    const result = await pipeline.handleMessage({ userId, channelId, text, replyToken });
    logger.info('webhook.handled', {
      channelId,
      businessOwnerId,
      userId,
      conversationId: result.conversationId,
      intentType: result.intent?.type,
      state: result.state,
    });

    // 慢任務已 ack 過 → 用 push 送結果（replyToken 已用掉/過期）
    if (isSlowTask) {
      await sendPushOnly(client, channel, userId, result.text);
    } else {
      await sendReplyOrPush(client, channel, userId, replyToken, result.text);
    }
  } catch (err) {
    logger.error('webhook.handler_failed', { channelId, userId, error: String(err) });
    Metrics.pushError('webhook.handler_failed', String(err).slice(0, 200), { channelId, userId });
    await sendReplyOrPush(client, channel, userId, replyToken, '系統發生錯誤，請稍後再試 🙏');
  }
}

// 判定是否為 taskforge 型慢任務（會阻塞數秒到數分鐘）
function isTaskforgeSlash(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t.startsWith('/')) return false;
  const head = t.split(/\s+/)[0].slice(1);
  return head === 'search' || head === 'analysis' || head === 'analyze' || head === 'write'
    || head === 'web-search' || head === 'sirius' || head === 'deneb';
}

// 只用 push 送訊息（ack 已用 replyToken，結果走 push）
async function sendPushOnly(
  client: messagingApi.MessagingApiClient | null,
  channel: Channel | null,
  userId: string,
  text: string,
): Promise<void> {
  if (!client || !userId) {
    logger.debug('webhook.no_push_client', { userId, text });
    return;
  }
  if (channel?.pushEnabled === false) {
    logger.debug('webhook.push_disabled', { channelId: channel?._key, userId });
    return;
  }
  const chunks = chunkForLine(text);
  const messages = chunks.map((c) => ({ type: 'text' as const, text: c }));
  try {
    await client.pushMessage({ to: userId, messages });
    logger.debug('webhook.pushed_result', { channelId: channel?._key ?? 'unknown', userId });
  } catch (err) {
    logger.error('webhook.push_failed', { channelId: channel?._key ?? 'unknown', userId, error: String(err) });
  }
}

// 回覆：3 秒內用 replyToken（免費），超過則用 push（需 channel 開 push 權限）
async function sendReplyOrPush(
  client: messagingApi.MessagingApiClient | null,
  channel: Channel | null,
  userId: string,
  replyToken: string | undefined,
  text: string,
): Promise<void> {
  const chunks = chunkForLine(text);
  const messages = chunks.map((c) => ({ type: 'text' as const, text: c }));

  if (client && replyToken) {
    try {
      await client.replyMessage({ replyToken, messages });
      return;
    } catch (err) {
      logger.info('webhook.reply_failed_fallback_push', { userId, error: String(err) });
    }
  }

  // reply 失敗或無 replyToken → push（LINE push 需授權 + channel pushEnabled）
  if (client && channel?.pushEnabled !== false && userId) {
    try {
      await client.pushMessage({ to: userId, messages });
      logger.debug('webhook.pushed', { channelId: channel?._key ?? 'unknown', userId });
    } catch (err) {
      logger.error('webhook.push_failed', { channelId: channel?._key ?? 'unknown', userId, error: String(err) });
    }
  } else {
    logger.debug('webhook.no_reply_client', { userId, text });
  }
}

async function handleMediaMessage(
  client: messagingApi.MessagingApiClient | null,
  blobClient: messagingApi.MessagingApiBlobClient | null,
  pipeline: ReturnType<typeof getPolarisPipeline>,
  userId: string,
  channelId: string,
  messageEvent: any,
  sourceType: string,
  businessOwnerId: string,
): Promise<void> {
  const msg = messageEvent.message ?? {};
  const mediaType = (msg.type as string) === 'image' ? 'image'
    : (msg.type as string) === 'video' ? 'video'
    : (msg.type as string) === 'audio' ? 'audio'
    : (msg.type as string) === 'file' ? 'file'
    : (msg.type as string) === 'sticker' ? 'sticker'
    : null;

  if (!mediaType) {
    logger.debug('webhook.unsupported_message_type', { userId, channelId, type: msg.type });
    return;
  }

  const payload: MediaPayload = {
    mediaType,
    messageId: msg.id,
    fileName: msg.fileName,
    fileSize: msg.fileSize,
    durationMs: msg.duration,
  };

  let media;
  try {
    media = blobClient
      ? await downloadAndStoreMedia(blobClient, channelId, userId, payload)
      : undefined;
  } catch (err) {
    logger.error('webhook.media_download_failed', { userId, channelId, mediaType, error: String(err) });
    const replyToken = replyTokenOf(messageEvent);
    if (client && replyToken) {
      await safeReply(client, replyToken, '收到您的多媒體訊息，但暫時無法下載處理 🙏');
    }
    return;
  }

  const replyToken = replyTokenOf(messageEvent);
  try {
    const result = await pipeline.handleMessage({
      userId,
      channelId,
      text: '',
      replyToken,
      media: {
        mediaType,
        messageId: msg.id,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        durationMs: msg.duration,
        storageKey: media?.storageKey,
      },
    });
    logger.info('webhook.media_handled', {
      channelId,
      businessOwnerId,
      userId,
      mediaType,
      storageKey: media?.storageKey,
      state: result.state,
    });
    if (client && replyToken) {
      const chunks = chunkForLine(result.text);
      const messages = chunks.map((c) => ({ type: 'text' as const, text: c }));
      await client.replyMessage({ replyToken, messages });
    }
  } catch (err) {
    logger.error('webhook.media_handler_failed', { channelId, userId, mediaType, error: String(err) });
    Metrics.pushError('webhook.media_handler_failed', String(err).slice(0, 200), { channelId, userId });
    if (client && replyToken) {
      await safeReply(client, replyToken, '收到您的多媒體訊息，處理中遇到問題 🙏');
    }
  }
}

function shouldRespondByMessage(
  sourceType: string,
  msgType: string,
  message: any,
  _businessOwnerId: string,
): boolean {
  if (sourceType === 'user') return true;
  if (sourceType === 'group' || sourceType === 'room') {
    if (msgType === 'text') {
      const text = message?.text ?? '';
      const mentionPatterns = [/@分身\b/, /@bot\b/i, /@Polaris\b/i, /@Sirius\b/i, /@Vega\b/i, /@Altair\b/i, /@Deneb\b/i];
      return mentionPatterns.some((re) => re.test(text));
    }
    return false;
  }
  return false;
}

async function safeReply(
  client: messagingApi.MessagingApiClient,
  replyToken: string,
  text: string,
): Promise<void> {
  try {
    const chunks = chunkForLine(text);
    const messages = chunks.map((c) => ({ type: 'text' as const, text: c }));
    await client.replyMessage({ replyToken, messages });
  } catch (err) {
    logger.error('webhook.safe_reply_failed', { error: String(err) });
  }
}

router.get('/health', (_req: any, res: any) => {
  res.json({ ok: true });
});

async function triggerSlidingWindowExtraction(userId: string, channelId: string): Promise<void> {
  try {
    const store = getConversationStore();
    const convs = await store.listByUser(userId, channelId);
    if (convs.length === 0) return;
    const conv = convs.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const history = (conv.history ?? []) as Array<{ role: string; content: string; at?: number }>;
    if (history.length < L1_WINDOW_SIZE) return;
    const overflowCount = history.length - L1_WINDOW_SIZE + 4;
    const overflow = history.slice(0, overflowCount);
    if (overflow.length === 0) return;
    enqueueExtraction({
      customerId: userId,
      channelId,
      messages: overflow.map((m) => ({
        role: (m.role === 'agent' ? 'agent' : 'user') as 'user' | 'agent',
        content: m.content ?? '',
        at: m.at ?? Date.now(),
      })),
    });
    logger.debug('webhook.l1_sliding_window.queued', { userId, channelId, overflow: overflow.length });
  } catch (e) {
    logger.warn('webhook.l1_sliding_window.failed', { error: String(e) });
  }
}

export default router;