import { useState } from 'react'

export function Agent() {
  const [persona, setPersona] = useState('You are a helpful sales assistant for a LINE OMO multi-tenant platform. Help users with product inquiries, appointments, and customer support.')
  const [model, setModel] = useState('gpt-4o')
  const [personToken, setPersonToken] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Agent Settings</h1>
        <p className="page-subtitle">Configure AI agent persona, model, and security</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">AI Persona</h2>
        <div className="form-group">
          <label className="form-label">System Prompt</label>
          <textarea
            className="form-input"
            rows={5}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Model</h2>
        <div className="form-group">
          <label className="form-label">AI Model</label>
          <select className="form-input" value={model} onChange={(e) => setModel(e.target.value)} style={{ maxWidth: 300 }}>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            <option value="claude-3.5-haiku">Claude 3.5 Haiku</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Person Token</h2>
        <div className="form-group">
          <label className="form-label">API Key (Person Token)</label>
          <input
            className="form-input"
            type="password"
            placeholder="Enter your Person Token..."
            value={personToken}
            onChange={(e) => setPersonToken(e.target.value)}
            style={{ maxWidth: 400 }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Used for tenant-isolated AI agent authentication
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Knowledge Base</h2>
        <div className="form-group">
          <label className="form-label">Upload Documents</label>
          <div className="dropzone">
            Drag & drop files here, or click to browse
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-primary" onClick={handleSave} style={{ padding: '10px 24px' }}>
          Save Configuration
        </button>
        {saved && (
          <span style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600 }}>
            \u2713 Configuration saved
          </span>
        )}
      </div>
    </>
  )
}
