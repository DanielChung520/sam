import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const topIcons: { icon: string; route: string; label: string }[] = [
  { icon: '\u2302', route: '/', label: 'Dashboard' },
  { icon: '\u263A', route: '/admins', label: 'Admins' },
  { icon: '\u2630', route: '/accounts', label: 'Accounts' },
  { icon: '\u25A3', route: '/channels', label: 'Channels' },
  { icon: '\u2709', route: '/cards', label: 'Cards' },
  { icon: '\u2699', route: '/agent', label: 'Agent' },
]

const menuGroups = [
  {
    title: 'Management',
    items: [
      { label: 'Dashboard', route: '/' },
      { label: 'Admins', route: '/admins' },
      { label: 'Accounts', route: '/accounts' },
      { label: 'Channels', route: '/channels' },
    ],
  },
  {
    title: 'Content',
    items: [{ label: 'Cards', route: '/cards' }],
  },
  {
    title: 'System',
    items: [{ label: 'Agent Settings', route: '/agent' }],
  },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const isActive = (route: string) => {
    if (route === '/') return location.pathname === '/'
    return location.pathname.startsWith(route)
  }

  return (
    <aside className="sidebar">
      <button className="sidebar-logo" onClick={() => navigate('/')} title="LINE\u4EE3\u7406">
        LA
      </button>

      <nav className="sidebar-nav">
        {topIcons.map((item) => (
          <button
            key={item.route}
            className={`nav-icon-btn ${isActive(item.route) ? 'active' : ''}`}
            onClick={() => navigate(item.route)}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <div style={{ position: 'relative' }}>
        <button
          className={`nav-icon-btn ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          title="Menu"
        >
          {'\u25A8'}
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position: 'absolute',
              left: 56,
              bottom: 0,
              width: 200,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              zIndex: 200,
              padding: 8,
            }}
          >
            {menuGroups.map((group) => (
              <div key={group.title} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-secondary)',
                    padding: '4px 8px',
                  }}
                >
                  {group.title}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.route}
                    onClick={() => {
                      navigate(item.route)
                      setMenuOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '6px 8px',
                      border: 'none',
                      background: isActive(item.route)
                        ? 'var(--primary-light)'
                        : 'transparent',
                      color: isActive(item.route)
                        ? 'var(--primary)'
                        : 'var(--text)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
