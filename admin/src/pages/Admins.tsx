import { useState } from 'react'
import { Modal } from '../components/Modal'

interface Admin {
  id: string
  username: string
  name: string
  role: string
  created: string
}

const MOCK: Admin[] = [
  { id: '1', username: 'super', name: 'Super Admin', role: 'superadmin', created: '2026-07-01' },
  { id: '2', username: 'admin1', name: 'Admin One', role: 'admin', created: '2026-07-15' },
  { id: '3', username: 'manager', name: 'Platform Manager', role: 'admin', created: '2026-07-20' },
]

export function Admins() {
  const [admins, setAdmins] = useState<Admin[]>(MOCK)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Admin | null>(null)
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'admin' })

  const filtered = admins.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.username.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditing(null)
    setForm({ username: '', password: '', name: '', role: 'admin' })
    setModalOpen(true)
  }

  const openEdit = (a: Admin) => {
    setEditing(a)
    setForm({ username: a.username, password: '', name: a.name, role: a.role })
    setModalOpen(true)
  }

  const handleSave = () => {
    if (editing) {
      setAdmins((prev) =>
        prev.map((a) => (a.id === editing.id ? { ...a, username: form.username, name: form.name, role: form.role } : a))
      )
    } else {
      setAdmins((prev) => [
        ...prev,
        { id: String(Date.now()), username: form.username, name: form.name, role: form.role, created: new Date().toISOString().slice(0, 10) },
      ])
    }
    setModalOpen(false)
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this admin?')) setAdmins((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Admin Management</h1>
        <p className="page-subtitle">Manage platform administrators</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <input className="toolbar-search" placeholder="Search admins..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="toolbar-spacer" />
          <button className="btn btn-primary" onClick={openAdd}>+ Add Admin</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Created</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.username}</td>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td>
                    <span className={`badge ${a.role === 'superadmin' ? 'badge-blue' : 'badge-gray'}`}>
                      {a.role}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{a.created}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(a)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No results</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title={editing ? 'Edit Admin' : 'Add Admin'} open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave}>
        <div className="form-group">
          <label className="form-label">Username</label>
          <input className="form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">{editing ? 'New Password (leave blank to keep)' : 'Password'}</label>
          <input className="form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </div>
      </Modal>
    </>
  )
}
