import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Admins } from './pages/Admins'
import { Accounts } from './pages/Accounts'
import { Channels } from './pages/Channels'
import { Cards } from './pages/Cards'
import { Agent } from './pages/Agent'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('admin-theme') || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('admin-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout onToggleTheme={toggleTheme} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="admins" element={<Admins />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="channels" element={<Channels />} />
          <Route path="cards" element={<Cards />} />
          <Route path="agent" element={<Agent />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
