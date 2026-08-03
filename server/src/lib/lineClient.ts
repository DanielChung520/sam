// LINE client factory — 依 channel 建立並快取 Messaging API client
//
// 從 webhook.ts 抽出共用：
//   - getClientForChannel(destination)：查 channel → 建立 client（60s 快取）
//   - getClientByChannelKey(key)：依 channel _key 建立
//   - getClientByChannel(channel)：直接給 Channel 物件建 client
//   - getBootClient()：無 channel 時的 fallback（env token）

import { messagingApi } from '@line/bot-sdk';
import { findChannelByDestination, findChannelById, type Channel } from '../data/channelRepo.js';

export interface ChannelClients {
  client: messagingApi.MessagingApiClient;
  blobClient: messagingApi.MessagingApiBlobClient;
  channel: Channel;
}

interface CacheEntry {
  clients: ChannelClients;
  cachedAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

let bootClient: messagingApi.MessagingApiClient | null = null;
const BOOT_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

export function getBootClient(): messagingApi.MessagingApiClient | null {
  if (!BOOT_ACCESS_TOKEN) return null;
  if (!bootClient) {
    bootClient = new messagingApi.MessagingApiClient({ channelAccessToken: BOOT_ACCESS_TOKEN });
  }
  return bootClient;
}

function newBlobClient(accessToken: string): messagingApi.MessagingApiBlobClient {
  return new messagingApi.MessagingApiBlobClient({ channelAccessToken: accessToken });
}

export function getClientByChannel(channel: Channel): ChannelClients {
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: channel.accessToken });
  const blobClient = newBlobClient(channel.accessToken);
  return { client, blobClient, channel };
}

function cacheSet(key: string, clients: ChannelClients): void {
  cache.set(key, { clients, cachedAt: Date.now() });
}

function cacheGet(key: string): ChannelClients | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.clients;
}

/** 依 webhook destination（bot user ID）查 channel 並建 client */
export async function getClientForChannel(destination: string): Promise<ChannelClients | null> {
  const cached = cacheGet(`dest:${destination}`);
  if (cached) return cached;
  const channel = await findChannelByDestination(destination);
  if (!channel || !channel.enabled) return null;
  const clients = getClientByChannel(channel);
  cacheSet(`dest:${destination}`, clients);
  return clients;
}

/** 依 channel _key 建 client（for 業務員 API：contacts/chats/broadcasts） */
export async function getClientByChannelKey(channelKey: string): Promise<ChannelClients | null> {
  const cached = cacheGet(`key:${channelKey}`);
  if (cached) return cached;
  const channel = await findChannelById(channelKey);
  if (!channel || !channel.enabled) return null;
  const clients = getClientByChannel(channel);
  cacheSet(`key:${channelKey}`, clients);
  return clients;
}

export function invalidateLineClientCache(channelKey?: string): void {
  if (channelKey) {
    cache.delete(`key:${channelKey}`);
  } else {
    cache.clear();
  }
}
