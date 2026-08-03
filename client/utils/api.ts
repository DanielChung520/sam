// API client — 真實 server 呼叫封裝
//
// 與 utils/mockApi.ts 保持相同函數簽名與回傳結構（{ data: ... }），
// 讓 screen 只需改 import 即可從 mock 切換到真實 API。
//
// Base：相對路徑 /api/v1（由 proxy:7010 轉發到 Express:9091）
// Auth：從 localStorage 讀 sam_token，帶 Authorization: Bearer

const BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function token(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem('sam_token') : null;
}

// 業務員目前操作的主身帳號（LINE 分身 channel key）
// ChannelContext 切換時寫入 localStorage sam_active_channel
function channelId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const key = localStorage.getItem('sam_active_channel');
    if (key) return key;
    const raw = localStorage.getItem('sam_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.channelIds?.[0] ?? null;
  } catch {
    return null;
  }
}

interface RequestOptions {
  skipChannel?: boolean;
}

async function request<T>(method: string, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  if (!options?.skipChannel) {
    const cid = channelId();
    if (cid) headers['x-channel-id'] = cid;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) message = j.error;
    } catch {
      /* 非 JSON 錯誤回應 */
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}

// ─── Channels ──────────────────────────────────────────

export interface MyChannel {
  key: string;
  name: string;
  avatar: string;
  destination: string;
}

export async function getMyChannels() {
  const json = await request<{ data: MyChannel[] }>('GET', '/channels/mine');
  return { data: json.data ?? [] };
}

// ─── Chats ────────────────────────────────────────────

export interface ChatItem {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  score: number;
  channelKey?: string;
  channelName?: string;
  channelColor?: string;
}

export async function getChats() {
  // 合併模式：不帶 channelId → server 依 JWT 合併名下所有主身帳號的聊天
  const json = await request<{ data: ChatItem[] }>('GET', '/chats', undefined, { skipChannel: true });
  return { data: json.data ?? [] };
}

export async function getChatDetail(contactId: string, channelKey?: string) {
  const qs = channelKey ? `?channelKey=${encodeURIComponent(channelKey)}` : '';
  return request<{ data: { contact: any; messages: any[] } }>('GET', `/chats/${contactId}${qs}`);
}

export async function postMessage(contactId: string, text: string, channelKey?: string) {
  const qs = channelKey ? `?channelKey=${encodeURIComponent(channelKey)}` : '';
  return request<{ data: any }>('POST', `/chats/${contactId}/messages${qs}`, { text });
}

// ─── Contacts ──────────────────────────────────────────

export interface ContactListItem {
  id: number;
  name: string;
  company: string;
  title: string;
  score: number;
  tags: string[];
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
}

export async function getContacts(tag?: string, search?: string) {
  const params = new URLSearchParams();
  if (tag && tag !== '全部') params.set('tag', tag);
  if (search) params.set('search', search);
  const qs = params.toString();
  const json = await request<{ data: ContactListItem[] }>('GET', `/contacts${qs ? `?${qs}` : ''}`);
  return { data: json.data ?? [] };
}

export async function getContactDetail(contactId: string) {
  return request<{ data: any }>('GET', `/contacts/${contactId}`);
}

export async function updateContact(contactId: string, fields: {
  title?: string;
  nickname?: string;
  honorific?: string;
  salutation?: string;
  phone?: string;
  email?: string;
  company?: string;
  address?: string;
  remark?: string;
  tags?: string[];
  displayName?: string;
}) {
  return request<{ data: any }>('PATCH', `/contacts/${contactId}`, fields);
}

// ─── Broadcasts ────────────────────────────────────────

export interface BroadcastItem {
  id: number;
  title: string;
  status: 'completed' | 'sending' | 'scheduled';
  total: number;
  sent: number;
  createdAt: string;
  template: string;
  scheduledAt?: string;
}

export async function getBroadcasts() {
  const json = await request<{ data: BroadcastItem[] }>('GET', '/broadcasts');
  return { data: json.data ?? [] };
}

export async function createBroadcast(body: { title: string; contactIds: number[]; template: string }) {
  return request<{ data: BroadcastItem }>('POST', '/broadcasts', body);
}

// ─── News ──────────────────────────────────────────────

export interface NewsItem {
  id: number;
  category: string;
  title: string;
  summary: string;
  source: string;
  time: string;
}

export async function getNews(category?: string) {
  const params = new URLSearchParams();
  if (category && category !== '全部') params.set('category', category);
  const qs = params.toString();
  const json = await request<{ data: NewsItem[] }>('GET', `/news${qs ? `?${qs}` : ''}`);
  return { data: json.data ?? [] };
}

// ─── Greetings ─────────────────────────────────────────

export interface GreetingItem {
  id: number;
  category: string;
  subcategory: string;
  style: string;
  templateText: string;
  tone: string;
}

export async function getGreetings(category?: string) {
  const params = new URLSearchParams();
  if (category && category !== '全部') params.set('category', category);
  const qs = params.toString();
  const json = await request<{ data: GreetingItem[] }>('GET', `/greetings${qs ? `?${qs}` : ''}`);
  return { data: json.data ?? [] };
}
