import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Skills } from './pages/Skills'
import { AgentCenter } from './pages/AgentCenter'
import { Accounts } from './pages/Accounts'
import { Channels } from './pages/Channels'
import { Cards } from './pages/Cards'
import { Files } from './pages/Files'
import { McpTools } from './pages/McpTools'
import { BusinessDocs } from './pages/BusinessDocs'

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
          <Route path="skills" element={<Skills />} />
          <Route path="agent-center" element={<AgentCenter />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="channels" element={<Channels />} />
          <Route path="cards" element={<Cards />} />
          <Route path="files" element={<Files />} />
          <Route path="mcp-tools" element={<McpTools />} />
          <Route path="business-docs" element={<BusinessDocs />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
