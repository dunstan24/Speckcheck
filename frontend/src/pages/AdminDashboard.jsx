import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function AdminDashboard() {
  const nav = useNavigate()
  const [activeTab, setActiveTab] = useState('games') // 'games' or 'users'
  const [games, setGames] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Ambil data user dari localStorage
  const user = JSON.parse(localStorage.getItem('user') || 'null')

  useEffect(() => {
    // Route Guard: Pastikan user adalah admin
    if (!user || user.role !== 'admin') {
      nav('/login')
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': String(user.token || ''),
          'X-User-Role': user.role
        }

        if (activeTab === 'games') {
          const res = await fetch(`${API}/api/admin/games-incomplete`, { headers })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Gagal mengambil data game')
          setGames(data.games || [])
        } else {
          const res = await fetch(`${API}/api/admin/users`, { headers })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Gagal mengambil data user')
          setUsers(data.users || [])
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activeTab, nav])

  if (!user || user.role !== 'admin') {
    return null // Mencegah kedipan UI sebelum redirect
  }

  return (
    <main style={{
      maxWidth: 1100,
      margin: '0 auto',
      padding: '3rem 2rem',
      animation: 'fadeUp 0.5s ease'
    }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontWeight: 800, fontSize: '2.2rem', letterSpacing: '-0.02em', marginBottom: 8 }}>
          Dashboard <span style={{ color: 'var(--accent)' }}>Admin</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>
          Kelola game yang memerlukan data spesifikasi dan pantau spesifikasi PC milik user terdaftar.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border)',
        marginBottom: '2rem',
        paddingBottom: '1px'
      }}>
        <button
          onClick={() => setActiveTab('games')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'games' ? 'rgba(0,212,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'games' ? 'var(--accent)' : 'transparent'}`,
            color: activeTab === 'games' ? 'var(--accent)' : 'var(--text2)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          🎮 Game Belum Lengkap ({loading && activeTab === 'games' ? '...' : games.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'users' ? 'rgba(0,212,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'users' ? 'var(--accent)' : 'transparent'}`,
            color: activeTab === 'users' ? 'var(--accent)' : 'var(--text2)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          👥 Data User Biasa ({loading && activeTab === 'users' ? '...' : users.length})
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(248, 113, 113, 0.1)',
          border: '1px solid rgba(248, 113, 113, 0.3)',
          borderRadius: 8,
          padding: '12px 16px',
          color: '#f87171',
          marginBottom: '1.5rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9rem'
        }}>
          ⚠️ Error: {error}
        </div>
      )}

      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem',
          color: 'var(--text2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '1.1rem'
        }}>
          ⏳ Memuat data...
        </div>
      ) : (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '1.5rem',
          overflowX: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          {activeTab === 'games' ? (
            /* Game Table */
            games.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
                Semua game memiliki data spesifikasi lengkap! 🚀
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: '0.8rem', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    <th style={{ padding: '12px 8px' }}>Cover</th>
                    <th style={{ padding: '12px 8px' }}>Nama Game</th>
                    <th style={{ padding: '12px 8px' }}>Grade</th>
                    <th style={{ padding: '12px 8px' }}>Sumber Data</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map(g => (
                    <tr key={g.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '12px 8px', width: 60 }}>
                        {g.cover_image_url ? (
                          <img
                            src={`${API}/api/image-proxy?url=${encodeURIComponent(g.cover_image_url)}`}
                            alt={g.name}
                            style={{ width: 40, height: 54, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }}
                            onError={e => e.target.style.display = 'none'}
                          />
                        ) : (
                          <span style={{ fontSize: '1.5rem' }}>🎮</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{g.name}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(148,163,184,0.1)',
                          border: '1px solid #94a3b8',
                          color: '#94a3b8',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontWeight: 700
                        }}>? (Unknown)</span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {g.url ? (
                          <a
                            href={g.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                          >
                            PCGamingWiki ↗
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text3)' }}>Tidak ada URL</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            /* Users Table */
            users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
                Belum ada user biasa yang terdaftar.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: '0.8rem', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    <th style={{ padding: '12px 8px' }}>ID</th>
                    <th style={{ padding: '12px 8px' }}>Username</th>
                    <th style={{ padding: '12px 8px' }}>Tanggal Daftar</th>
                    <th style={{ padding: '12px 8px' }}>Spesifikasi Terdeteksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '12px 8px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>#{u.id}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--accent2)' }}>{u.username}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--text2)' }}>{u.created_at || '-'}</td>
                      <td style={{ padding: '12px 8px' }}>
                        {u.spec ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem' }}>
                              🖥️ {u.spec.cpuName} ({u.spec.cpu} MHz)
                            </span>
                            <span style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem' }}>
                              🧠 RAM {u.spec.ram} GB
                            </span>
                            <span style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem' }}>
                              🎴 {u.spec.gpuName} ({u.spec.vram} GB VRAM)
                            </span>
                            <span style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem' }}>
                              💾 Disk Free {u.spec.disk} GB
                            </span>
                            <span style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem' }}>
                              💿 OS: {u.spec.os}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Belum cek spesifikasi</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}
    </main>
  )
}
