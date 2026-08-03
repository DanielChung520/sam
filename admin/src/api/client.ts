const BASE = '/api/v1'

function token() {
  return localStorage.getItem('admin_token')
}

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = token()
  if (t) headers['Authorization'] = `Bearer ${t}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }

  return res.json()
}

export function get<T = any>(path: string): Promise<T> {
  return request('GET', path) as Promise<T>
}

export function post<T = any>(path: string, data?: unknown): Promise<T> {
  return request('POST', path, data) as Promise<T>
}

export function patch<T = any>(path: string, data?: unknown): Promise<T> {
  return request('PATCH', path, data) as Promise<T>
}

export function put<T = any>(path: string, data?: unknown): Promise<T> {
  return request('PUT', path, data) as Promise<T>
}

export function del<T = any>(path: string): Promise<T> {
  return request('DELETE', path) as Promise<T>
}
