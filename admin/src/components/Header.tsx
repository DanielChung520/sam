import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import NotificationsIcon from '@mui/icons-material/Notifications'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SettingsIcon from '@mui/icons-material/Settings'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/skills': 'Skills',
  '/admins': 'Admin Management',
  '/accounts': 'Account Management',
  '/channels': 'LINE Channel Management',
  '/cards': 'Card Management',
  '/agent': 'Agent Settings',
}

export function Header({ onToggleTheme }: { onToggleTheme: () => void }) {
  const location = useLocation()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const title = pageTitles[location.pathname] || 'LINE代理 Platform Admin'
  const theme = document.documentElement.getAttribute('data-theme')
  const userStr = localStorage.getItem('admin_user')
  const user = userStr ? JSON.parse(userStr) : null
  const initial = user?.name?.[0]?.toUpperCase() || 'A'

  return (
    <header className="header">
      <div className="header-title">{title}</div>
      <div className="header-actions">
        <button className="header-btn" title="Notifications">
          <NotificationsIcon sx={{ fontSize: 22 }} />
          <span className="badge-dot" />
        </button>
        <button className="header-btn" onClick={onToggleTheme} title="Toggle theme">
          {mounted && theme === 'dark'
            ? <LightModeIcon sx={{ fontSize: 22 }} />
            : <DarkModeIcon sx={{ fontSize: 22 }} />
          }
        </button>
        <button className="header-btn" title="Settings">
          <SettingsIcon sx={{ fontSize: 22 }} />
        </button>
        <div className="header-avatar" title={user?.name || 'Admin'}>
          {initial}
        </div>
      </div>
    </header>
  )
}
