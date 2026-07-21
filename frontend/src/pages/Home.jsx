import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import pcTiersData from '../data/pc_tiers.json'


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
  const [featuredGames, setFeaturedGames] = useState([])
  const [loadingFeatured, setLoadingFeatured] = useState(true)

  useEffect(() => {
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
        fontFamily: 'var(--font-secondary)', fontWeight: 600, fontSize: '1.75rem',
        letterSpacing: '-0.01em', marginBottom: 4
      }}>{text}</h2>
      {sub && <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, color: 'var(--text2)', fontSize: '0.88rem', lineHeight: 1.5 }}>{sub}</p>}
    </div>
  )

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 2rem 4rem' }}>

      {/* ── 1. EXPLANATION SECTION (WHAT IS THIS WEBSITE) ── */}
      <section style={{
        textAlign: 'center',
        marginBottom: '3.5rem',
        animation: 'fadeUp 0.5s ease',
      }}>

        <h1 style={{
          fontFamily: 'var(--font-primary)', fontWeight: 700,
          fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', lineHeight: 1.1,
          letterSpacing: '0.02em', marginBottom: '1.25rem',
        }}>
          Cek Kompatibilitas PC Kamu<br />
          <span style={{ color: 'var(--accent)' }}>Instan, Akurat, dan Cerdas.</span>
        </h1>

        <p style={{
          fontFamily: 'var(--font-body)', fontWeight: 400,
          fontSize: '1rem', color: 'var(--text2)', lineHeight: 1.65,
          marginBottom: '2rem', maxWidth: 680, margin: '0 auto 2rem',
        }}>
          <strong style={{ color: '#fff', fontWeight: 600 }}>Bisa main nggak?</strong> membandingkan hardware PC Anda dengan database spesifikasi ribuan game secara real-time. 
          Cari tahu apakah komputer Anda mampu menjalankan game impian Anda pada spesifikasi Minimum maupun Rekomendasi 
          sebelum membelinya.
        </p>

        {/* Dedicated CTA Button to Test Your PC Page */}
        <button
          onClick={() => nav('/test-pc')}
          style={{
            fontFamily: 'var(--font-primary)',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#000',
            border: 'none',
            fontSize: '0.92rem',
            padding: '14px 32px',
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
                fontFamily: 'var(--font-primary)', fontSize: '1.8rem', fontWeight: 800,
                color: g.color, lineHeight: 1, marginBottom: 6,
              }}>{g.grade}</div>
              <div style={{ fontFamily: 'var(--font-secondary)', fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: g.color }}>{g.label}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'var(--text2)', lineHeight: 1.4 }}>{g.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2b. PC TIERS RECOMMENDATIONS ── */}
      <section style={{
        marginBottom: '3.5rem',
        animation: 'fadeUp 0.5s 0.25s ease both',
        opacity: 0, animationFillMode: 'forwards',
      }}>
        {sectionTitle('Rekomendasi Spesifikasi PC', 'Pilih salah satu spesifikasi PC rekomendasi berdasarkan budget untuk melihat kemampuan bermain game')}
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {pcTiersData?.tiers?.map(tier => {
            // Mapping specifications for navigation query params
            const tierMapping = {
              under_10m: { cpuVal: 4300, gpuVal: 8, cpuName: 'Intel Core i3-12100F', gpuName: 'NVIDIA GeForce GTX 1660 Super', ram: 16, disk: 512 },
              around_10m: { cpuVal: 4400, gpuVal: 12, cpuName: 'AMD Ryzen 5 5600', gpuName: 'NVIDIA GeForce RTX 3060', ram: 16, disk: 1000 },
              around_15m: { cpuVal: 5100, gpuVal: 8, cpuName: 'AMD Ryzen 5 7600', gpuName: 'NVIDIA GeForce RTX 4060 Ti', ram: 32, disk: 1000 }
            }
            const map = tierMapping[tier.id] || {}
            
            const testPCUrl = `/test-pc?cpuName=${encodeURIComponent(map.cpuName)}&cpu=${map.cpuVal}&gpuName=${encodeURIComponent(map.gpuName)}&ram=${map.ram}&disk=${map.disk}`
            
            const resultsUrl = `/results?cpuName=${encodeURIComponent(map.cpuName)}&cpu=${map.cpuVal}&gpuName=${encodeURIComponent(map.gpuName)}&ram=${map.ram}&disk=${map.disk}`

            return (
              <div key={tier.id} style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,184,66,0.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
              }}
              >
                {/* Header info */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-secondary)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)' }}>
                      {tier.name}
                    </h3>
                  </div>

                  <div style={{
                    fontFamily: 'var(--font-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--accent)',
                    background: 'rgba(229,184,66,0.08)',
                    border: '1px solid rgba(229,184,66,0.15)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    display: 'inline-block',
                    marginBottom: '1.25rem'
                  }}>
                    {tier.price_range}
                  </div>

                  {/* Spec List */}
                  <div style={{
                    background: 'var(--bg3)',
                    borderRadius: 10,
                    padding: '0.85rem',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text3)' }}>Processor</span>
                        <span style={{ fontWeight: 500, color: 'var(--text2)', textAlign: 'right' }}>{tier.specs.cpu}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text3)' }}>VGA Card</span>
                        <span style={{ fontWeight: 500, color: 'var(--text2)', textAlign: 'right' }}>{tier.specs.gpu}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text3)' }}>RAM</span>
                        <span style={{ fontWeight: 500, color: 'var(--text2)', textAlign: 'right' }}>{tier.specs.ram}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text3)' }}>Storage</span>
                        <span style={{ fontWeight: 500, color: 'var(--text2)', textAlign: 'right' }}>{tier.specs.storage}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Buttons */}
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    onClick={() => nav(resultsUrl)}
                    style={{
                      fontFamily: 'var(--font-primary)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      width: '100%',
                      background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                      color: '#000',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 8px',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(229,184,66,0.15)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-0.5px)' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
                  >
                    Cek Kompatibilitas →
                  </button>
                </div>
              </div>

            )
          })}
        </div>
      </section>


      {/* ── 3. FEATURED FAMOUS GAMES (3 POPULAR GAMES) ── */}
      <section style={{
        marginBottom: '3.5rem',
        animation: 'fadeUp 0.5s 0.3s ease both',
        opacity: 0, animationFillMode: 'forwards',
      }}>
        {sectionTitle('Game Populer', 'Pilih salah satu game ternama di bawah untuk langsung mengecek performanya di spesifikasi Anda')}

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
