import { useState, useEffect } from 'react'

export function Footer() {
  const [time, setTime] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <footer className="footer">
      <div className="footer-left">
        <div className="status-indicator">
          <span className="status-dot online" />
          <span>API Online</span>
        </div>
        <div className="status-indicator">
          <span className="status-dot online" />
          <span>LINE Connected</span>
        </div>
      </div>
      <div className="footer-right">
        <span>{time}</span>
        <span>v0.1.0</span>
      </div>
    </footer>
  )
}
