import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { get } from '../api/client'

interface MetricsSnapshot {
  channels: { total: number; active: number }
  skills: { total: number; enabled: number }
  subAgents: { active: number }
  messages24h: Array<{ hour: string; count: number }>
  topSkills: Array<{ skillId: string; calls: number }>
  recentErrors: Array<{ ts: string; scope: string; message: string; context?: string }>
  generatedAt: string
}

export function Dashboard() {
  const navigate = useNavigate()
  const [m, setM] = useState<MetricsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await get<{ data: MetricsSnapshot }>('/admin/metrics')
      setM(res.data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    pollRef.current = setInterval(fetchMetrics, 60_000)
    return () => clearInterval(pollRef.current)
  }, [fetchMetrics])

  const statCards = [
    { icon: '\uD83D\uDCF1', value: m ? String(m.channels.active) : '...', label: 'LINE Channels', sub: m ? `${m.channels.total} total` : '', route: '/channels' },
    { icon: '\uD83E\uDD16', value: m ? String(m.skills.enabled) : '...', label: 'Active Skills', sub: m ? `${m.skills.total} total` : '', route: '/skills' },
    { icon: '\u2699\uFE0F', value: m ? String(m.subAgents.active) : '...', label: 'Running Sub-Agents', route: '/sub-agents' },
    { icon: '\uD83D\uDCCA', value: m ? String(m.messages24h.reduce((a, b) => a + b.count, 0)) : '...', label: 'Messages (24h)', sub: m ? `Last update: ${new Date(m.generatedAt).toLocaleTimeString()}` : '', route: '/agent' },
  ]

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Platform overview — auto-refreshes every 60s</p>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', background: '#fee2e2', color: 'var(--danger)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          Failed to load metrics: {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="card-grid">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="stat-card"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(s.route)}
          >
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            {s.sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* 24h Message Volume */}
        <div className="card" style={{ flex: '1 1 380px', minWidth: 0 }}>
          <h2 className="section-title">Messages (24h)</h2>
          {m && m.messages24h.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={m.messages24h}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty" style={{ padding: 24 }}>No message data yet.</div>
          )}
        </div>

        {/* Top Skills */}
        <div className="card" style={{ flex: '1 1 380px', minWidth: 0 }}>
          <h2 className="section-title">Top Skills</h2>
          {m && m.topSkills.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={m.topSkills} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="skillId" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="calls" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty" style={{ padding: 24 }}>No skills called yet.</div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h2 className="section-title">Quick Actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Manage Admins', route: '/admins' },
              { label: 'Configure Channels', route: '/channels' },
              { label: 'View Cards', route: '/cards' },
              { label: 'Agent Settings', route: '/agent' },
            ].map((a) => (
              <button
                key={a.route}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => navigate(a.route)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 300px' }}>
          <h2 className="section-title">System Status</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'API Server', status: 'Online', dot: 'online' },
              { label: 'LINE Messaging API', status: 'Connected', dot: 'online' },
              { label: 'Database', status: 'Online', dot: 'online' },
              { label: 'Webhook Endpoint', status: 'Active', dot: 'online' },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span className={`status-dot ${s.dot}`} />
                <span style={{ flex: 1 }}>{s.label}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{s.status}</span>
              </div>
            ))}
            {m && m.recentErrors.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                <span className="status-dot offline" style={{ display: 'inline-block', marginRight: 6 }} />
                {m.recentErrors.length} recent error{m.recentErrors.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Recent Errors */}
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h2 className="section-title">Recent Errors</h2>
          {m && m.recentErrors.length > 0 ? (
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {m.recentErrors.map((e, i) => (
                <div key={i} className="log-entry">
                  <span className="log-time">{new Date(e.ts).toLocaleTimeString()}</span>
                  <span className="log-channel">{e.scope}</span>
                  <span className="log-msg" style={{ flex: 1 }}>{e.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ padding: 24 }}>No errors recorded.</div>
          )}
        </div>
      </div>

      {/* Recent Activity placeholder */}
      <div className="card">
        <h2 className="section-title">Recent Activity</h2>
        <div className="empty" style={{ padding: 24 }}>
          Activity log will appear as the platform is used.
        </div>
      </div>
    </>
  )
}
