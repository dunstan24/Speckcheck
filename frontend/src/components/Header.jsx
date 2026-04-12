import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const loc = useLocation()
  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      background: 'rgba(5,10,15,0.9)',
      backdropFilter: 'blur(20px)',
      position: 'sticky', top: 0, zIndex: 100,
      padding: '0 2rem',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>⚡</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '1.2rem',
            letterSpacing: '-0.02em',
          }}>
            <span style={{ color: 'var(--accent)' }}>Spec</span>
            <span style={{ color: 'var(--text)' }}>Check</span>
            <span style={{ color: 'var(--accent2)' }}>.AI</span>
          </span>
        </Link>

        <nav style={{ display: 'flex', gap: '0.25rem' }}>
          {[['/', 'Beranda'], ['/manual', 'Input Manual'], ['/results', 'Hasil']].map(([path, label]) => (
            <Link key={path} to={path} style={{
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: loc.pathname === path ? 'var(--accent)' : 'var(--text2)',
              background: loc.pathname === path ? 'rgba(0,212,255,0.08)' : 'transparent',
              border: `1px solid ${loc.pathname === path ? 'rgba(0,212,255,0.3)' : 'transparent'}`,
              transition: 'all 0.2s',
            }}>{label}</Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
