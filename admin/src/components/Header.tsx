import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
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

  const title = pageTitles[location.pathname] || 'LINE\u4EE3\u7406 Platform Admin'
  const theme = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme')
    : null

  return (
    <header className="header">
      <div className="header-title">{title}</div>
      <div className="header-actions">
        <button className="header-btn" title="Notifications">
          \uD83D\uDD14
          <span className="badge-dot" />
        </button>
        <button className="header-btn" onClick={onToggleTheme} title="Toggle theme">
          {mounted && theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
        </button>
        <button className="header-btn" title="Settings">
          \u2699\uFE0F
        </button>
      </div>
    </header>
  )
}
