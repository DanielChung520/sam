import { useNavigate } from 'react-router-dom'

const stats = [
  { icon: '\uD83D\uDC64', value: '3', label: 'Total Admins', route: '/admins' },
  { icon: '\uD83D\uDCF1', value: '1', label: 'LINE Channels', route: '/channels' },
  { icon: '\uD83D\uDC65', value: '2', label: 'Accounts', route: '/accounts' },
  { icon: '\uD83E\uDD16', value: '1', label: 'Active Agents', route: '/agent' },
]

export function Dashboard() {
  const navigate = useNavigate()

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Platform overview</p>
      </div>

      <div className="card-grid">
        {stats.map((s) => (
          <div
            key={s.label}
            className="stat-card"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(s.route)}
          >
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ flex: 1 }}>
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

        <div className="card" style={{ flex: 1 }}>
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
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Recent Activity</h2>
        <div className="empty" style={{ padding: 24 }}>
          Activity log will appear as the platform is used.
        </div>
      </div>
    </>
  )
}
