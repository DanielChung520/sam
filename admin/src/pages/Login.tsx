import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (localStorage.getItem('admin_token')) navigate('/', { replace: true })
  }, [navigate])

  const handleLogin = () => {
    if (!username || !password) {
      setError('Please enter username and password')
      return
    }
    localStorage.setItem('admin_token', 'mock-jwt-token-' + Date.now())
    localStorage.setItem('admin_user', JSON.stringify({ username, name: username, role: 'superadmin' }))
    navigate('/', { replace: true })
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 40,
          width: 380,
          maxWidth: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: 'var(--primary)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 18,
              margin: '0 auto 12px',
            }}
          >
            LA
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>LINE\u4EE3\u7406</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Platform Admin Login</p>
        </div>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#dc2626',
              fontSize: 13,
              padding: '8px 12px',
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            className="form-input"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError('') }}
            placeholder="Enter username"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder="Enter password"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '10px', justifyContent: 'center', marginTop: 8 }}
          onClick={handleLogin}
        >
          Sign In
        </button>
      </div>
    </div>
  )
}
