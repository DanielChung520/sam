import { useState, useEffect } from 'react'
import { get, post, patch as apiPatch, del } from '../api/client'

interface BusinessAccount {
  _key: string
  name: string
  email: string
  username?: string
  phone?: string
  role?: string
  lastLoginAt?: number
  businessOwnerId: string
  channelIds: string[]
  enabled: boolean
  source: 'admin' | 'web'
  createdAt: number
  updatedAt: number
}

interface Channel {
  _key: string
  name: string
  channelId: string
}

function fmtDate(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateTime(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${fmtDate(ts)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function Accounts() {
  const [accounts, setAccounts] = useState<BusinessAccount[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BusinessAccount | null>(null)
  const [form, setForm] = useState({ name: '', email: '', businessOwnerId: '', username: '', password: '', phone: '', role: 'business', channelId: '' })
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [aRes, cRes] = await Promise.all([
        get<{ data: BusinessAccount[] }>('/admin/accounts'),
        get<{ data: Channel[] }>('/admin/channels'),
      ])
      setAccounts(aRes.data ?? [])
      setChannels(cRes.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const filtered = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.businessOwnerId.includes(search) ||
      (a.phone ?? '').includes(search) ||
      (a.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', email: '', businessOwnerId: '', username: '', password: '', phone: '', role: 'business', channelId: '' })
    setModalOpen(true)
  }

  const openEdit = (a: BusinessAccount) => {
    setEditing(a)
    setForm({
      name: a.name,
      email: a.email,
      businessOwnerId: a.businessOwnerId,
      username: a.username ?? '',
      password: '',
      phone: a.phone ?? '',
      role: a.role ?? 'business',
      channelId: a.channelIds[0] ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const channelIds = form.channelId ? [form.channelId] : []
      if (editing) {
        const body: Record<string, unknown> = { name: form.name, email: form.email, channelIds, phone: form.phone, role: form.role }
        if (form.username) body.username = form.username
        if (form.password) body.password = form.password
        await apiPatch(`/admin/accounts/${encodeURIComponent(editing._key)}`, body)
      } else {
        await post('/admin/accounts', {
          name: form.name,
          email: form.email,
          businessOwnerId: form.businessOwnerId,
          username: form.username || undefined,
          password: form.password || undefined,
          phone: form.phone,
          role: form.role,
          channelIds,
        })
      }
      setModalOpen(false)
      await loadAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account?')) return
    try {
      await del(`/admin/accounts/${encodeURIComponent(id)}`)
      await loadAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  const channelMap = Object.fromEntries(channels.map((c) => [c._key, c.name]))

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Accounts</h1>
        <p className="page-subtitle">Business agent accounts — each account has a role and owns LINE channels</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <input className="toolbar-search" placeholder="Search name / ID / phone / email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="toolbar-spacer" />
          <button className="btn btn-primary" onClick={openAdd} disabled={loading}>+ Add Account</button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: '#fee2e2', color: 'var(--danger)', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
            ⚠ {error}
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Account (Business ID)</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Login</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No results</td></tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a._key}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.businessOwnerId}</td>
                    <td style={{ fontSize: 12 }}>{a.email || '-'}</td>
                    <td style={{ fontSize: 12 }}>{a.phone || '-'}</td>
                    <td>
                      <span className={`badge ${a.role === 'admin' ? 'badge-red' : a.role === 'business' ? 'badge-blue' : 'badge-gray'}`}>
                        {a.role ?? 'business'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${a.enabled ? 'badge-green' : 'badge-gray'}`}>
                        {a.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtDate(a.createdAt)}</td>
                    <td style={{ fontSize: 11, color: a.lastLoginAt ? 'var(--text)' : 'var(--text-secondary)' }}>
                      {fmtDateTime(a.lastLoginAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(a)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a._key)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Account' : 'Add Account'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Account（Business ID）*</label>
                <input className="form-input" value={form.businessOwnerId} onChange={(e) => setForm({ ...form, businessOwnerId: e.target.value })} disabled={!!editing} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">登入帳號（username）</label>
                <input className="form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder={editing ? '留空不變更' : '與 Business ID 相同'} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">密碼</label>
                <input className="form-input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? '留空不變更' : '預設 1234@5'} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">手機號</label>
                <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xx-xxxxxx" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">角色標記</label>
                <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">admin</option>
                  <option value="business">business</option>
                  <option value="staff">staff</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Channel</label>
                <select className="form-input" value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })}>
                  <option value="">— None —</option>
                  {channels.map((c) => (
                    <option key={c._key} value={c._key}>{c.name} ({c.channelId})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name || !form.businessOwnerId}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
