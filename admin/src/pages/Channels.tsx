import { useState } from 'react'
import { Modal } from '../components/Modal'

interface Channel {
  id: string
  name: string
  channelId: string
  channelSecret: string
  webhook: string
  status: 'connected' | 'pending' | 'error'
}

const MOCK: Channel[] = [
  {
    id: '1',
    name: 'My LINE Channel',
    channelId: '2003127685',
    channelSecret: 'd9b5348a1019dc21f2c018beda43ad41',
    webhook: 'https://la.aiconn.ai/webhook',
    status: 'connected',
  },
]

export function Channels() {
  const [channels, setChannels] = useState<Channel[]>(MOCK)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Channel | null>(null)
  const [form, setForm] = useState({ name: '', channelId: '', channelSecret: '' })

  const filtered = channels.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.channelId.includes(search)
  )

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', channelId: '', channelSecret: '' })
    setModalOpen(true)
  }

  const openEdit = (c: Channel) => {
    setEditing(c)
    setForm({ name: c.name, channelId: c.channelId, channelSecret: c.channelSecret })
    setModalOpen(true)
  }

  const handleSave = () => {
    if (editing) {
      setChannels((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...form } : c)))
    } else {
      setChannels((prev) => [
        ...prev,
        { id: String(Date.now()), ...form, webhook: 'https://la.aiconn.ai/webhook', status: 'pending' },
      ])
    }
    setModalOpen(false)
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this channel?')) setChannels((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">LINE Channel Management</h1>
        <p className="page-subtitle">Configure LINE Messaging API channels</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          All webhooks point to: <code style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>https://la.aiconn.ai/webhook</code>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <input className="toolbar-search" placeholder="Search channels..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="toolbar-spacer" />
          <button className="btn btn-primary" onClick={openAdd}>+ Add Channel</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel ID</th>
                <th>Channel Secret</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.channelId}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {'\u2022'.repeat(24)}
                  </td>
                  <td>
                    <span className={`badge ${c.status === 'connected' ? 'badge-green' : c.status === 'pending' ? 'badge-gray' : 'badge-red'}`}>
                      {c.status}
                    </span>
                  </td>
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

      <Modal title={editing ? 'Edit Channel' : 'Add Channel'} open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave}>
        <div className="form-group">
          <label className="form-label">Channel Name</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Channel ID</label>
          <input className="form-input" value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Channel Secret</label>
          <input className="form-input" value={form.channelSecret} onChange={(e) => setForm({ ...form, channelSecret: e.target.value })} />
        </div>
      </Modal>
    </>
  )
}
