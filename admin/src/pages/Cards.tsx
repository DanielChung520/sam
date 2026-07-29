import { useState } from 'react'
import { Modal } from '../components/Modal'

interface Card {
  id: string
  title: string
  description: string
  imageUrl: string
  status: string
  created: string
}

const MOCK: Card[] = [
  { id: '1', title: 'Welcome Card', description: 'New customer welcome greeting', imageUrl: 'https://via.placeholder.com/300x200', status: 'active', created: '2026-07-20' },
  { id: '2', title: 'Promotion Q3', description: 'Quarterly promotion announcement card with discount codes', imageUrl: 'https://via.placeholder.com/300x200', status: 'active', created: '2026-07-22' },
]

export function Cards() {
  const [cards, setCards] = useState<Card[]>(MOCK)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Card | null>(null)
  const [form, setForm] = useState({ title: '', description: '', imageUrl: '', status: 'active' })

  const filtered = cards.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))

  const openAdd = () => {
    setEditing(null)
    setForm({ title: '', description: '', imageUrl: '', status: 'active' })
    setModalOpen(true)
  }

  const openEdit = (c: Card) => {
    setEditing(c)
    setForm({ title: c.title, description: c.description, imageUrl: c.imageUrl, status: c.status })
    setModalOpen(true)
  }

  const handleSave = () => {
    if (editing) {
      setCards((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...form } : c)))
    } else {
      setCards((prev) => [
        ...prev,
        { id: String(Date.now()), ...form, created: new Date().toISOString().slice(0, 10) },
      ])
    }
    setModalOpen(false)
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this card?')) setCards((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Card Management</h1>
        <p className="page-subtitle">Manage greeting cards</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <input className="toolbar-search" placeholder="Search cards..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="toolbar-spacer" />
          <button className="btn btn-primary" onClick={openAdd}>+ Add Card</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.title}</td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.description}
                  </td>
                  <td>
                    <span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{c.status}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.created}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>Del</button>
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

      <Modal title={editing ? 'Edit Card' : 'Add Card'} open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave}>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Image URL</label>
          <input className="form-input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </Modal>
    </>
  )
}
