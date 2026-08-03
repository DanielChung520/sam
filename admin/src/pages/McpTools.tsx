import { useEffect, useState } from 'react'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import { get } from '../api/client'

interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export function McpTools() {
  const [tools, setTools] = useState<McpTool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchTools = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get<{ data: McpTool[] }>('/mcp/tools')
      setTools(res.data ?? [])
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load MCP tools')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTools()
  }, [])

  const stats = {
    total: tools.length,
    enabled: tools.length,
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">MCP Tools</h1>
        <p className="page-subtitle">Model Context Protocol tools — {stats.enabled}/{stats.total} enabled</p>
      </div>

      <div className="card-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon">🔧</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total MCP Tools</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{stats.enabled}</div>
          <div className="stat-label">Enabled</div>
        </div>
      </div>

      {loading && <div className="card"><div className="empty" style={{ padding: 32 }}>Loading MCP tools...</div></div>}

      {error && (
        <div className="card">
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 13, marginBottom: 12 }}>{error}</div>
            <button className="btn btn-primary" onClick={fetchTools}>Retry</button>
          </div>
        </div>
      )}

      {!loading && !error && tools.length === 0 && (
        <div className="card">
          <div className="empty" style={{ padding: 32 }}>
            No MCP tools found. Is taskforge running on :9900?
          </div>
        </div>
      )}

      {!loading && !error && tools.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {tools.map((t) => (
            <div key={t.name} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ color: '#8b5cf6' }}>
                  <TravelExploreIcon sx={{ fontSize: 22 }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Enabled</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {t.description ?? 'No description'}
              </div>
              {t.inputSchema && (
                <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                  schema: {Object.keys(t.inputSchema.properties ?? {}).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
