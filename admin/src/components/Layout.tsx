import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { Footer } from './Footer'

interface LayoutProps {
  onToggleTheme: () => void
}

export function Layout({ onToggleTheme }: LayoutProps) {
  return (
    <div className="app-shell">
      <div className="app-body">
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Header onToggleTheme={onToggleTheme} />
          <main className="main-content">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}
