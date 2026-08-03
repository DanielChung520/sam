import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import SoapIcon from '@mui/icons-material/Soap'
import PersonIcon from '@mui/icons-material/Person'
import ChatIcon from '@mui/icons-material/Chat'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import FolderIcon from '@mui/icons-material/Folder'
import ExtensionIcon from '@mui/icons-material/Extension'
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks'

const iconSx = { fontSize: 26 }

const topIcons: { icon: React.ReactNode; route: string; label: string }[] = [
  { icon: <PersonIcon sx={iconSx} />, route: '/accounts', label: 'Accounts' },
  { icon: <ChatIcon sx={iconSx} />, route: '/channels', label: 'Channels' },
  { icon: <CreditCardIcon sx={iconSx} />, route: '/cards', label: 'Cards' },
  { icon: <SmartToyIcon sx={iconSx} />, route: '/agent-center', label: 'Agent Center' },
  { icon: <SoapIcon sx={iconSx} />, route: '/skills', label: 'Skills' },
  { icon: <LibraryBooksIcon sx={iconSx} />, route: '/business-docs', label: 'Knowledge' },
  { icon: <FolderIcon sx={iconSx} />, route: '/files', label: 'Files' },
  { icon: <ExtensionIcon sx={iconSx} />, route: '/mcp-tools', label: 'MCP' },
]

const menuGroups = [
  {
    title: 'Management',
    items: [
      { label: 'Dashboard', route: '/' },
      { label: 'Accounts', route: '/accounts' },
      { label: 'Channels', route: '/channels' },
      { label: 'Agent Center', route: '/agent-center' },
      { label: 'Skills', route: '/skills' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Cards', route: '/cards' },
      { label: 'Knowledge', route: '/business-docs' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Files', route: '/files' },
      { label: 'MCP Tools', route: '/mcp-tools' },
    ],
  },
]

function TooltipBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <div className="tooltip-wrap">
      <button
        className={`nav-icon-btn ${active ? 'active' : ''}`}
        onClick={onClick}
      >
        {icon}
      </button>
      <span className="tooltip">{label}</span>
    </div>
  )
}

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
      <div className="tooltip-wrap">
        <button className="sidebar-logo" onClick={() => navigate('/')}>
          <img src="/aiconn4-ball.png" alt="LINE代理" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
        </button>
        <span className="tooltip">LINE代理</span>
      </div>

      <nav className="sidebar-nav">
        {topIcons.map((item) => (
          <TooltipBtn
            key={item.route}
            icon={item.icon}
            label={item.label}
            active={isActive(item.route)}
            onClick={() => navigate(item.route)}
          />
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <div style={{ position: 'relative' }}>
        <div className="tooltip-wrap">
          <button
            className={`nav-icon-btn ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {'\u25A8'}
          </button>
          <span className="tooltip">Menu</span>
        </div>

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
