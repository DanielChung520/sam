// Mock API — 前端離線 mock，不依賴後端
// 回傳格式比照後端 API：{ data: ... }

import {
  assistantChat,
  contacts,
  chatMessages,
  broadcasts,
  greetingTemplates,
  newsItems,
  usbStatus,
  getNextMessageId,
  getNextBroadcastId,
} from './mockData';

const delay = (ms = 250) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ─── Chats ────────────────────────────────────────────

export async function getChats() {
  await delay();
  const data = [
    // 置頂：AI 助理聊天室
    {
      id: assistantChat.id,
      name: assistantChat.name,
      avatar: assistantChat.avatar,
      lastMessage: assistantChat.lastMessage,
      lastMessageTime: assistantChat.lastMessageTime,
      unreadCount: assistantChat.unreadCount,
      score: 100,
    },
    // 好友對話
    ...contacts.map(c => ({
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      lastMessage: c.lastMessage,
      lastMessageTime: c.lastMessageTime,
      unreadCount: c.unreadCount,
      score: c.score,
    })),
  ];
  return { data };
}

export async function getChatDetail(contactId: number) {
  await delay();
  // 助理聊天室（id = 0）
  if (contactId === 0) {
    const messages = chatMessages[0] || [];
    return {
      data: {
        contact: {
          id: 0,
          name: assistantChat.name,
          avatar: assistantChat.avatar,
          title: 'AI 銷售助理',
          company: 'SAM',
          score: 100,
        },
        messages,
      },
    };
  }
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) throw new Error(`Contact ${contactId} not found`);
  const messages = chatMessages[contactId] || [];
  return {
    data: {
      contact: {
        id: contact.id,
        name: contact.name,
        avatar: contact.avatar,
        title: contact.title,
        company: contact.company,
        score: contact.score,
      },
      messages,
    },
  };
}

export async function postMessage(contactId: number, text: string) {
  await delay(100);
  const newMsg = {
    id: getNextMessageId(),
    senderId: 'me' as const,
    text,
    time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    type: 'text' as const,
  };
  if (!chatMessages[contactId]) chatMessages[contactId] = [];
  chatMessages[contactId].push(newMsg);
  return { data: newMsg };
}

// ─── Contacts ───────────────────────────────────────────

export async function getContacts(tag?: string, search?: string) {
  await delay();
  let data = contacts.map(c => ({
    id: c.id,
    name: c.name,
    company: c.company,
    title: c.title,
    score: c.score,
    tags: c.tags,
    avatar: c.avatar,
    lastMessage: c.lastMessage,
    lastMessageTime: c.lastMessageTime,
  }));
  if (tag && tag !== '全部') {
    data = data.filter(c => c.tags.includes(tag));
  }
  if (search) {
    const q = search.toLowerCase();
    data = data.filter(c => c.name.toLowerCase().includes(q));
  }
  return { data };
}

export async function getContactDetail(contactId: number) {
  await delay();
  const c = contacts.find(c => c.id === contactId);
  if (!c) throw new Error(`Contact ${contactId} not found`);
  return {
    data: {
      id: c.id,
      name: c.name,
      company: c.company,
      title: c.title,
      phone: c.phone,
      email: c.email,
      address: c.address,
      score: c.score,
      tags: c.tags,
      avatar: c.avatar,
      messageCount7d: c.messageCount7d,
      replySeconds: c.replySeconds,
      proactiveCount: c.proactiveCount,
      turnCount: c.turnCount,
    },
  };
}

// ─── Broadcasts ─────────────────────────────────────────

export async function getBroadcasts() {
  await delay();
  return { data: broadcasts };
}

export async function createBroadcast(body: { title: string; contactIds: number[]; template: string }) {
  await delay(300);
  const newBc = {
    id: getNextBroadcastId(),
    title: body.title,
    status: 'scheduled' as const,
    total: body.contactIds.length,
    sent: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    template: body.template,
    scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16).replace('T', ' '),
  };
  broadcasts.unshift(newBc);
  return { data: newBc };
}

// ─── News ───────────────────────────────────────────────

export async function getNews(category?: string) {
  await delay();
  let data = newsItems;
  if (category && category !== '全部') {
    data = data.filter(n => n.category === category);
  }
  return { data };
}

// ─── Greetings ──────────────────────────────────────────

export async function getGreetings(category?: string) {
  await delay();
  let data = greetingTemplates;
  if (category && category !== '全部') {
    data = data.filter(g => g.category === category);
  }
  return { data };
}
