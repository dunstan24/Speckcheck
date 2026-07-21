import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname.includes('bisamainnggak.com') ? 'https://api.bisamainnggak.com' : 'http://localhost:5000');

const proxyImageUrl = (url) => {
  if (!url) return null
  return `${API}/api/image-proxy?url=${encodeURIComponent(url)}`
}

const RANK_COLORS = ['#e5b842', '#94a3b8', '#cd7c41']
const RANK_LABELS = ['#1', '#2', '#3']

function TrendingCard({ game, rank, onClick }) {
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)
  const rankColor = RANK_COLORS[rank] || 'var(--text3)'
  const isTop3 = rank < 3

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${hovered ? (isTop3 ? rankColor : 'var(--accent)') : 'var(--border)'}`,
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        padding: '1rem 1.25rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateX(4px)' : 'translateX(0)',
        boxShadow: hovered ? `0 4px 20px rgba(0,0,0,0.3)` : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle left accent for top 3 */}
      {isTop3 && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: rankColor, borderRadius: '14px 0 0 14px',
        }} />
      )}

      {/* Rank badge */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: isTop3 ? `${rankColor}18` : 'var(--bg3)',
        border: `2px solid ${isTop3 ? rankColor : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontWeight: 900,
        fontSize: isTop3 ? '1.1rem' : '0.9rem',
        color: isTop3 ? rankColor : 'var(--text3)',
      }}>
        {isTop3 ? RANK_LABELS[rank] : `#${rank + 1}`}
      </div>

      {/* Cover image */}
      {game.cover_image_url && !imgError ? (
        <img
          src={proxyImageUrl(game.cover_image_url)}
          alt={game.name}
          onError={() => setImgError(true)}
          style={{
            width: 44, height: 60, objectFit: 'cover',
            borderRadius: 6, border: '1px solid var(--border)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div style={{
          width: 44, height: 60, borderRadius: 6,
          background: 'var(--bg3)', border: '1px solid var(--border)',
          flexShrink: 0,
        }} />
      )}

      {/* Game info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-secondary)',
          fontWeight: 600, fontSize: '0.98rem',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 6, color: 'var(--text)',
        }}>
          {game.name}
        </div>
        {/* Simple bar chart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, height: 5, background: 'var(--bg3)',
            borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (game.view_count / (game._maxViews || game.view_count || 1)) * 100)}%`,
              background: isTop3 ? rankColor : 'var(--accent)',
              borderRadius: 3,
              transition: 'width 0.8s ease',
            }} />
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
            color: 'var(--text3)', flexShrink: 0, minWidth: 52, textAlign: 'right',
          }}>
            {game.view_count.toLocaleString()} views
          </span>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 14, display: 'flex', alignItems: 'center',
      gap: '1.25rem', padding: '1rem 1.25rem',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg3)', flexShrink: 0 }} />
      <div style={{ width: 44, height: 60, borderRadius: 6, background: 'var(--bg3)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          height: 16, borderRadius: 4, width: '60%',
          background: 'linear-gradient(90deg, var(--bg3) 25%, rgba(255,255,255,0.05) 50%, var(--bg3) 75%)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
        }} />
        <div style={{
          height: 6, borderRadius: 3, width: '80%',
          background: 'linear-gradient(90deg, var(--bg3) 25%, rgba(255,255,255,0.05) 50%, var(--bg3) 75%)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
        }} />
      </div>
    </div>
  )
}

export default function Trending() {
  const nav = useNavigate()
  const [trending, setTrending] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/analytics/trending`)
      .then(r => r.json())
      .then(data => {
        if (data.trending) {
          // Tambahkan _maxViews ke setiap item agar bar chart proporsinya relatif
          const maxViews = data.trending[0]?.view_count || 1
          setTrending(data.trending.map(g => ({ ...g, _maxViews: maxViews })))
        }
      })
      .catch(() => setError('Gagal memuat data trending'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2.5rem 1.5rem', animation: 'fadeUp 0.4s ease' }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-primary)', fontWeight: 700,
          fontSize: 'clamp(2rem, 4vw, 2.8rem)', margin: '0 0 0.5rem 0',
          letterSpacing: '0.02em',
        }}>
          Game Trending
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, color: 'var(--text2)', fontSize: '0.92rem', margin: 0, lineHeight: 1.6 }}>
          Top 10 game paling banyak dikunjungi dalam 30 hari terakhir.
        </p>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            {error}
          </div>
        ) : trending.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 14,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text3)', fontSize: '0.85rem' }}>
              Belum ada data trending saat ini.
            </div>
          </div>
        ) : (
          trending.map((game, i) => (
            <TrendingCard
              key={game.id}
              game={game}
              rank={i}
              onClick={() => nav(`/game/${game.id}`)}
            />
          ))
        )}
      </div>


    </main>
  )
}
