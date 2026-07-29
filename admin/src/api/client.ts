const BASE = 'http://localhost:7010/api/v1'

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

export function get(path: string) {
  return request('GET', path)
}

export function post(path: string, data?: unknown) {
  return request('POST', path, data)
}

export function put(path: string, data?: unknown) {
  return request('PUT', path, data)
}

export function del(path: string) {
  return request('DELETE', path)
}
