// api.ts 單元測試 — 驗證 fetch 封裝：帶 token、正確 URL、{data} 解析、錯誤處理

import {
  getChats,
  getContacts,
  getBroadcasts,
  getNews,
  getGreetings,
  getChatDetail,
  postMessage,
  getContactDetail,
  createBroadcast,
  ApiError,
} from '../utils/api'

// ── 測試環境準備 ──

const originalFetch = global.fetch
const originalLocalStorage = global.localStorage

function mockFetchImpl(handler: (url: string, init?: RequestInit) => Promise<unknown>) {
  global.fetch = jest.fn(async (input: any, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url
    const body = await handler(url, init)
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response
  }) as unknown as typeof fetch
}

function mockFetchError(status: number, message: string) {
  global.fetch = jest.fn(async () => ({
    ok: false,
    status,
    json: async () => ({ error: message }),
  })) as unknown as typeof fetch
}

beforeEach(() => {
  global.localStorage = {
    getItem: jest.fn((k: string) => {
      if (k === 'sam_token') return 'test-jwt-token'
      if (k === 'sam_user') return JSON.stringify({ name: '測試', channelIds: ['ch-abc'] })
      return null
    }),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    key: jest.fn(),
    length: 0,
  } as unknown as Storage
})

afterEach(() => {
  global.fetch = originalFetch
  global.localStorage = originalLocalStorage
})

// ── Tests ──

describe('api.ts request 封裝', () => {
  test('getChats 帶 Bearer token + x-channel-id 且打正確 URL', async () => {
    let capturedUrl = ''
    let capturedAuth = ''
    let capturedChannel = ''
    mockFetchImpl((url, init) => {
      capturedUrl = url
      const headers = (init?.headers as Record<string, string>) ?? {}
      capturedAuth = headers.Authorization ?? ''
      capturedChannel = headers['x-channel-id'] ?? ''
      return { data: [{ id: 1, name: '張三' }] }
    })
    const res = await getChats()
    expect(capturedUrl).toBe('/api/v1/chats')
    expect(capturedAuth).toBe('Bearer test-jwt-token')
    expect(capturedChannel).toBe('ch-abc')
    // server 回傳 1 筆 + client 注入置頂 AI 助理 = 2 筆
    expect(res.data).toHaveLength(2)
    expect(res.data[0].id).toBe(0) // 置頂 AI
    expect(res.data[0].name).toBe('AI 銷售助理')
  })

  test('getContacts 帶 query 參數（tag + search）', async () => {
    let capturedUrl = ''
    mockFetchImpl((url) => {
      capturedUrl = url
      return { data: [] }
    })
    await getContacts('VIP', '張')
    expect(capturedUrl).toBe('/api/v1/contacts?tag=VIP&search=%E5%BC%B5')
  })

  test('getContacts 帶「全部」tag 時不加參數', async () => {
    let capturedUrl = ''
    mockFetchImpl((url) => {
      capturedUrl = url
      return { data: [] }
    })
    await getContacts('全部', undefined)
    expect(capturedUrl).toBe('/api/v1/contacts')
  })

  test('postMessage 打 POST 且帶 body', async () => {
    let capturedUrl = ''
    let capturedBody = ''
    mockFetchImpl((url, init) => {
      capturedUrl = url
      capturedBody = String(init?.body)
      return { data: { id: 99 } }
    })
    await postMessage(5, '你好')
    expect(capturedUrl).toBe('/api/v1/chats/5/messages')
    expect(capturedBody).toContain('"text":"你好"')
  })

  test('getNews / getGreetings 正確 URL', async () => {
    let newsUrl = ''
    mockFetchImpl((url) => {
      newsUrl = url
      return { data: [] }
    })
    await getNews('科技')
    expect(newsUrl).toBe('/api/v1/news?category=%E7%A7%91%E6%8A%80')
    let greetingUrl = ''
    mockFetchImpl((url) => {
      greetingUrl = url
      return { data: [] }
    })
    await getGreetings('全部')
    expect(greetingUrl).toBe('/api/v1/greetings')
  })

  test('錯誤回應拋出 ApiError 帶 server message', async () => {
    mockFetchError(401, '帳號或密碼錯誤')
    await expect(getChats()).rejects.toThrow(ApiError)
    try {
      await getChats()
    } catch (e) {
      expect((e as ApiError).status).toBe(401)
      expect((e as ApiError).message).toBe('帳號或密碼錯誤')
    }
  })

  test('無 token 時不帶 Authorization header', async () => {
    global.localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    } as unknown as Storage
    let capturedAuth = 'present'
    mockFetchImpl((_url, init) => {
      capturedAuth = (init?.headers as Record<string, string>)?.Authorization ?? ''
      return { data: [] }
    })
    await getChats()
    expect(capturedAuth).toBe('')
  })
})
