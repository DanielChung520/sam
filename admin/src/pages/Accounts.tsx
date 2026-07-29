import { useState } from 'react'
import { Modal } from '../components/Modal'

interface Account {
  id: string
  name: string
  lineUserId: string
  channelId: string
  status: string
  lastActive: string
}

const MOCK: Account[] = [
  { id: '1', name: 'Demo User', lineUserId: 'U1234567890abcdef', channelId: '2003127685', status: 'active', lastActive: '2026-07-29 10:30' },
  { id: '2', name: 'Test Agent', lineUserId: 'U0987654321fedcba', channelId: '2003127685', status: 'active', lastActive: '2026-07-28 15:20' },
]

export function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>(MOCK)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState({ name: '', lineUserId: '', channelId: '' })

  const filtered = accounts.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.lineUserId.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', lineUserId: '', channelId: '2003127685' })
    setModalOpen(true)
  }

  const openEdit = (a: Account) => {
    setEditing(a)
    setForm({ name: a.name, lineUserId: a.lineUserId, channelId: a.channelId })
    setModalOpen(true)
  }

  const handleSave = () => {
    if (editing) {
      setAccounts((prev) => prev.map((a) => (a.id === editing.id ? { ...a, ...form } : a)))
    } else {
      setAccounts((prev) => [
        ...prev,
        { id: String(Date.now()), ...form, status: 'active', lastActive: new Date().toLocaleString() },
      ])
    }
    setModalOpen(false)
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this account?')) setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Account Management</h1>
        <p className="page-subtitle">Manage business agent accounts</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <input className="toolbar-search" placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="toolbar-spacer" />
          <button className="btn btn-primary" onClick={openAdd}>+ Add Account</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>LINE User ID</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Last Active</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.lineUserId}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.channelId}</td>
                  <td>
                    <span className={`badge ${a.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{a.status}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.lastActive}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(a)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No results</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title={editing ? 'Edit Account' : 'Add Account'} open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave}>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">LINE User ID</label>
          <input className="form-input" value={form.lineUserId} onChange={(e) => setForm({ ...form, lineUserId: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Channel ID</label>
          <input className="form-input" value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })} />
        </div>
      </Modal>
    </>
  )
}
