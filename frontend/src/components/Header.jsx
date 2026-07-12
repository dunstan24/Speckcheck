import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

export default function Header() {
  const loc = useLocation()
  const nav = useNavigate()
  const [user, setUser] = useState(null)

  const checkAuth = () => {
    const u = localStorage.getItem('user')
    setUser(u ? JSON.parse(u) : null)
  }

  useEffect(() => {
    checkAuth()
    window.addEventListener('authChange', checkAuth)
    return () => window.removeEventListener('authChange', checkAuth)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('user_spec')
    setUser(null)
    nav('/')
    window.dispatchEvent(new Event('authChange'))
  }

  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      background: 'rgba(11,11,14,0.95)',
      backdropFilter: 'blur(20px)',
      position: 'sticky', top: 0, zIndex: 100,
      padding: '0 2rem',
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: '1.2rem' }}>⚡</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '1.1rem',
            letterSpacing: '-0.02em',
          }}>
            <span style={{ color: 'var(--accent)' }}>Bisa</span>
            <span style={{ color: 'var(--text)' }}> Main</span>
            <span style={{ color: 'var(--accent2)' }}> Nggak Ya</span>
          </span>
        </Link>

        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {[['/', 'Beranda'], ['/test-pc', 'Test Your PC'], ['/results', 'Game List']].map(([path, label]) => {
            const isActive = path.includes('#')
              ? (loc.pathname === '/' && loc.hash === path.substring(path.indexOf('#')))
              : (loc.pathname === path && !loc.hash);

            return (
              <Link key={path} to={path} style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                position: 'relative',
                padding: '6px 0',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color = 'var(--accent)'}
              onMouseLeave={e => e.target.style.color = isActive ? 'var(--accent)' : 'var(--text2)'}
              >
                {label}
                {isActive && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                    background: 'var(--accent)', borderRadius: 1
                  }} />
                )}
              </Link>
            );
          })}

          {user && user.role === 'admin' && (
            <>
              <Link to="/hardware" style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: loc.pathname === '/hardware' ? 'var(--accent)' : 'var(--accent2)',
                position: 'relative',
                padding: '6px 0',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color = 'var(--accent)'}
              onMouseLeave={e => e.target.style.color = loc.pathname === '/hardware' ? 'var(--accent)' : 'var(--accent2)'}
              >
                🔬 DB HW
                {loc.pathname === '/hardware' && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                    background: 'var(--accent)', borderRadius: 1
                  }} />
                )}
              </Link>
              <Link to="/admin" style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: loc.pathname === '/admin' ? 'var(--accent)' : 'var(--accent2)',
                position: 'relative',
                padding: '6px 0',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color = 'var(--accent)'}
              onMouseLeave={e => e.target.style.color = loc.pathname === '/admin' ? 'var(--accent)' : 'var(--accent2)'}
              >
                🔑 Admin
                {loc.pathname === '/admin' && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                    background: 'var(--accent)', borderRadius: 1
                  }} />
                )}
              </Link>
            </>
          )}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <>
              <Link to="/profile" style={{
                fontSize: '0.875rem',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 14px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 10px rgba(var(--accent-rgb), 0.25)' }}
              onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
              >
                👤 {user.username}
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(248, 113, 113, 0.3)',
                  color: '#f87171',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.target.style.background = 'rgba(248, 113, 113, 0.08)' }}
                onMouseLeave={e => { e.target.style.background = 'transparent' }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: '#000',
                borderRadius: 6,
                padding: '6px 16px',
                fontSize: '0.875rem',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => e.target.style.opacity = 0.9}
              onMouseLeave={e => e.target.style.opacity = 1}
            >
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

