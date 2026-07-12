import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const GRADE_DEFS = [
  { grade: 'S', label: 'Sangat Optimal', desc: 'Semua komponen melebihi rekomendasi', color: '#e5b842', bg: 'rgba(229,184,66,0.06)' },
  { grade: 'A', label: 'Direkomendasikan', desc: 'Memenuhi spesifikasi rekomendasi', color: '#10b981', bg: 'rgba(16,185,129,0.06)' },
  { grade: 'B', label: 'Bisa (Minimum)', desc: 'Memenuhi spesifikasi minimum', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
  { grade: 'C', label: 'Di Bawah Minimum', desc: 'Beberapa komponen kurang memadai', color: '#f97316', bg: 'rgba(249,115,22,0.06)' },
  { grade: 'D', label: 'Tidak Bisa', desc: 'Tidak memenuhi syarat minimum', color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
]

export default function Home() {
  const nav = useNavigate()
  const [gameCount, setGameCount] = useState(null)
  const [featuredGames, setFeaturedGames] = useState([])
  const [loadingFeatured, setLoadingFeatured] = useState(true)

  useEffect(() => {
    // Fetch live game count (Optimized: fetch count only, not all records)
    const loadGameCount = async () => {
      try {
        const res = await fetch(`${API}/api/software/count`)
        const data = await res.json()
        setGameCount(data.count)
      } catch { setGameCount(null) }
    }
    loadGameCount()

    // Fetch featured games (Exactly 3 popular games)
    const loadFeaturedGames = async () => {
      try {
        setLoadingFeatured(true)
        const res = await fetch(`${API}/api/software/featured`)
        const data = await res.json()
        setFeaturedGames(data)
      } catch (err) {
        console.error('Failed to fetch featured games:', err)
      } finally {
        setLoadingFeatured(false)
      }
    }
    loadFeaturedGames()
  }, [])

  const sectionTitle = (text, sub) => (
    <div style={{ marginBottom: '1.5rem' }}>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem',
        letterSpacing: '-0.01em', marginBottom: 4
      }}>{text}</h2>
      {sub && <p style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>{sub}</p>}
    </div>
  )

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 2rem 4rem' }}>

      {/* ── 1. EXPLANATION SECTION (WHAT IS THIS WEBSITE) ── */}
      <section style={{
        textAlign: 'center',
        marginBottom: '3rem',
        animation: 'fadeUp 0.5s ease',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '4px 14px', marginBottom: '1.25rem',
          fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text2)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}/>
          {gameCount !== null ? `${gameCount.toLocaleString('id-ID')} Game Terdaftar` : 'Menganalisis Database...'}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', lineHeight: 1.15,
          letterSpacing: '-0.025em', marginBottom: '1rem',
        }}>
          Cek Kompatibilitas PC Kamu<br />
          <span style={{ color: 'var(--accent)' }}>Instan, Akurat, dan Cerdas.</span>
        </h1>

        <p style={{
          fontSize: '0.92rem', color: 'var(--text2)', lineHeight: 1.7,
          marginBottom: '2rem', maxWidth: 650, margin: '0 auto 2rem',
        }}>
          <strong>Bisa Main Nggak Ya</strong> membandingkan hardware PC Anda dengan database spesifikasi ribuan game secara real-time. 
          Cari tahu apakah komputer Anda mampu menjalankan game impian Anda pada spesifikasi Minimum maupun Rekomendasi 
          sebelum membelinya.
        </p>

        {/* Dedicated CTA Button to Test Your PC Page */}
        <button
          onClick={() => nav('/test-pc')}
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#000',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.95rem',
            padding: '12px 28px',
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(229,184,66,0.25)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = '0.9';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'none';
          }}
        >
          Test PC Kamu Sekarang →
        </button>
      </section>

      {/* ── 2. GRADE SYSTEM EXPLAINER ── */}
      <section style={{
        marginBottom: '3.5rem',
        animation: 'fadeUp 0.5s 0.2s ease both',
        opacity: 0, animationFillMode: 'forwards',
      }}>
        {sectionTitle('Sistem Penilaian', 'Spesifikasi Anda akan dinilai berdasarkan standar performa berikut')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
          {GRADE_DEFS.map(g => (
            <div key={g.grade} style={{
              background: g.bg, border: `1px solid ${g.color}15`,
              borderRadius: 10, padding: '1rem 0.75rem', textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 800,
                color: g.color, lineHeight: 1, marginBottom: 6,
              }}>{g.grade}</div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', marginBottom: 4, color: g.color }}>{g.label}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text2)', lineHeight: 1.4 }}>{g.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. FEATURED FAMOUS GAMES (3 POPULAR GAMES) ── */}
      <section style={{
        marginBottom: '3.5rem',
        animation: 'fadeUp 0.5s 0.3s ease both',
        opacity: 0, animationFillMode: 'forwards',
      }}>
        {sectionTitle('🎮 Game Populer', 'Pilih salah satu game ternama di bawah untuk langsung mengecek performanya di spesifikasi Anda')}

        {loadingFeatured ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 12, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Loading game data...</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.25rem'
          }}>
            {featuredGames.map(game => (
              <div key={game.id} style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {/* Cover Image */}
                <div style={{
                  height: 140,
                  background: 'var(--bg3)',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {game.cover_image_url ? (
                    <img 
                      src={`${API}/api/image-proxy?url=${encodeURIComponent(game.cover_image_url)}`} 
                      alt={game.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  ) : null}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, var(--bg2) 10%, transparent 90%)'
                  }} />
                </div>

                {/* Game Title & Link */}
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', lineHeight: 1.4 }}>
                    {game.name}
                  </h3>
                  <Link 
                    to={`/game/${game.id}`}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      background: 'var(--bg3)',
                      color: 'var(--accent)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#000' }}
                    onMouseLeave={e => { e.target.style.background = 'var(--bg3)'; e.target.style.color = 'var(--accent)' }}
                  >
                    Lihat Detail & Cek Spek
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  )
}
