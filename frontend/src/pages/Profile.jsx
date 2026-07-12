import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function Profile() {
  const nav = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [spec, setSpec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const checkAuth = () => {
    const u = localStorage.getItem('user')
    if (!u) {
      nav('/login')
      return
    }
    setUser(JSON.parse(u))
  }

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!user) return

    const loadProfileAndSpec = async () => {
      setLoading(true)
      try {
        // Fetch Profile
        const profRes = await fetch(`${API}/api/user/profile`, {
          headers: { 'Authorization': String(user.token || '') }
        })
        if (profRes.status === 401) {
          handleForceLogout()
          return
        }
        const profData = await profRes.json()
        if (profRes.ok) {
          setProfile(profData)
        }

        // Fetch Spec
        const specRes = await fetch(`${API}/api/user/spec`, {
          headers: { 'Authorization': String(user.token || '') }
        })
        if (specRes.status === 401) {
          handleForceLogout()
          return
        }
        const specData = await specRes.json()
        if (specRes.ok && specData.spec) {
          setSpec(specData.spec)
        }
      } catch (err) {
        console.error('Error loading profile/spec:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfileAndSpec()
  }, [user])

  const handleForceLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('user_spec')
    window.dispatchEvent(new Event('authChange'))
    nav('/login')
  }

  const handleLogout = () => {
    handleForceLogout()
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')

    if (!pwForm.new_password || !pwForm.confirm_password) {
      setPwError('Password baru dan konfirmasi wajib diisi')
      return
    }
    if (pwForm.new_password.length < 8) {
      setPwError('Password baru minimal 8 karakter')
      return
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('Konfirmasi password baru tidak cocok')
      return
    }
    if (profile?.has_password && !pwForm.current_password) {
      setPwError('Password lama wajib diisi')
      return
    }

    setPwLoading(true)
    try {
      const res = await fetch(`${API}/api/user/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': String(user.token || '')
        },
        body: JSON.stringify({
          current_password: pwForm.current_password,
          new_password: pwForm.new_password
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah password')
      }

      // Update session token dengan token baru agar tidak ter-logout di device ini
      const updatedUser = { ...user, token: data.token }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setUser(updatedUser)

      setPwSuccess('Password berhasil diperbarui! Sesi di perangkat lain telah diinvalidasi.')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
      
      // Update local profile status
      setProfile(p => ({ ...p, has_password: true }))
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwLoading(false)
    }
  }

  const handleDeleteSpec = async () => {
    if (!window.confirm('Yakin ingin menghapus spesifikasi PC tersimpan?')) return

    try {
      const res = await fetch(`${API}/api/user/spec`, {
        method: 'DELETE',
        headers: { 'Authorization': String(user.token || '') }
      })
      if (res.status === 401) {
        handleForceLogout()
        return
      }
      if (res.ok) {
        setSpec(null)
        localStorage.removeItem('user_spec')
      } else {
        alert('Gagal menghapus spesifikasi')
      }
    } catch (err) {
      console.error(err)
      alert('Terjadi kesalahan')
    }
  }

  if (loading || !profile) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text2)'
      }}>
        ⏳ Memuat profil...
      </div>
    )
  }

  return (
    <main style={{
      maxWidth: 800,
      margin: '3rem auto',
      padding: '0 1.5rem',
      animation: 'fadeUp 0.5s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem'
    }}>
      {/* SECTION 1: HEADER PROFIL */}
      <section style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        flexWrap: 'wrap'
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)',
          border: '2px solid rgba(255,255,255,0.1)'
        }}>
          👤
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.8rem',
              fontWeight: 800,
              margin: 0
            }}>{profile.username}</h1>
            <span style={{
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              background: profile.auth_provider === 'google' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(167, 139, 250, 0.15)',
              border: `1px solid ${profile.auth_provider === 'google' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(167, 139, 250, 0.4)'}`,
              color: profile.auth_provider === 'google' ? '#60a5fa' : '#c084fc',
              padding: '2px 8px',
              borderRadius: 6,
              textTransform: 'uppercase'
            }}>
              {profile.auth_provider === 'google' ? '🔵 Google Account' : '⚙️ Akun Lokal'}
            </span>
          </div>
          {profile.email && (
            <p style={{ color: 'var(--text2)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              ✉️ {profile.email}
            </p>
          )}
          <p style={{ color: 'var(--text3)', margin: '0.25rem 0 0 0', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
            📅 Bergabung: {new Date(profile.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </section>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem'
      }}>
        {/* SECTION 2: KEAMANAN AKUN (GANTI PASSWORD) */}
        <section style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: '0 0 1.5rem 0',
              color: 'var(--accent2)'
            }}>🔒 Keamanan Akun</h2>

            {pwError && (
              <div style={{
                background: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#f87171',
                fontSize: '0.8rem',
                marginBottom: '1rem',
                fontFamily: 'var(--font-mono)'
              }}>
                ⚠️ {pwError}
              </div>
            )}

            {pwSuccess && (
              <div style={{
                background: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#4ade80',
                fontSize: '0.8rem',
                marginBottom: '1rem',
                fontFamily: 'var(--font-mono)'
              }}>
                ✅ {pwSuccess}
              </div>
            )}

            {!profile.has_password && (
              <p style={{ color: 'var(--text2)', fontSize: '0.82rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                💡 <strong>Info:</strong> Akun Anda masuk via Google dan belum memiliki password lokal. Setel password baru di bawah untuk mengaktifkan opsi login cadangan via username + password.
              </p>
            )}

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {profile.has_password && (
                <div>
                  <label style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text2)',
                    textTransform: 'uppercase',
                    marginBottom: 4
                  }}>Password Lama</label>
                  <input
                    type="password"
                    value={pwForm.current_password}
                    onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                    placeholder="Masukkan password saat ini"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--text2)',
                  textTransform: 'uppercase',
                  marginBottom: 4
                }}>Password Baru</label>
                <input
                  type="password"
                  value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                  placeholder="Minimal 8 karakter"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--text2)',
                  textTransform: 'uppercase',
                  marginBottom: 4
                }}>Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={pwForm.confirm_password}
                  onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                  placeholder="Ulangi password baru"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={pwLoading}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, var(--accent2), #a78bfa)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  padding: '12px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                  opacity: pwLoading ? 0.7 : 1,
                  transition: 'opacity 0.15s'
                }}
              >
                {pwLoading ? '⏳ Memproses...' : profile.has_password ? 'Ubah Password →' : 'Setel Password Lokal →'}
              </button>
            </form>
          </div>
        </section>

        {/* SECTION 3: SPESIFIKASI PC */}
        <section style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: '0 0 1.5rem 0',
              color: 'var(--accent)'
            }}>🖥️ Spesifikasi PC Tersimpan</h2>

            {spec ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  lineHeight: 1.4
                }}>
                  <div><strong style={{ color: 'var(--accent)' }}>CPU:</strong> {spec.cpuName} ({spec.cpu} MHz)</div>
                  <div><strong style={{ color: 'var(--accent)' }}>GPU:</strong> {spec.gpuName} ({spec.vram} GB VRAM)</div>
                  <div><strong style={{ color: 'var(--accent)' }}>RAM:</strong> {spec.ram} GB</div>
                  <div><strong style={{ color: 'var(--accent)' }}>Disk:</strong> {spec.disk} GB</div>
                  <div><strong style={{ color: 'var(--accent)' }}>OS:</strong> {spec.os}</div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <Link
                    to="/"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      background: 'rgba(229, 184, 66, 0.08)',
                      border: '1px solid var(--accent)',
                      color: 'var(--accent)',
                      borderRadius: 8,
                      padding: '10px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#000' }}
                    onMouseLeave={e => { e.target.style.background = 'rgba(229, 184, 66, 0.08)'; e.target.style.color = 'var(--accent)' }}
                  >
                    ✏️ Perbarui
                  </Link>

                  <button
                    onClick={handleDeleteSpec}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: '1px solid rgba(248, 113, 113, 0.4)',
                      color: '#f87171',
                      borderRadius: 8,
                      padding: '10px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.target.style.background = 'rgba(248, 113, 113, 0.08)' }}
                    onMouseLeave={e => { e.target.style.background = 'transparent' }}
                  >
                    🗑️ Hapus
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <span style={{ fontSize: '2rem' }}>🔌</span>
                <p style={{ color: 'var(--text2)', fontSize: '0.85rem', margin: 0 }}>
                  Belum ada spesifikasi PC yang tersimpan di akun Anda.
                </p>
                <Link
                  to="/"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                    color: '#000',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    padding: '8px 16px',
                    borderRadius: 6,
                    textDecoration: 'none'
                  }}
                >
                  Input Spek Sekarang →
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* SECTION 4: AKSI AKUN (LOGOUT) */}
      <section style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '1.5rem 2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>
          Apakah Anda ingin mengakhiri sesi login saat ini?
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid #f87171',
            color: '#f87171',
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.target.style.background = '#f87171'; e.target.style.color = '#000' }}
          onMouseLeave={e => { e.target.style.background = 'rgba(248, 113, 113, 0.1)'; e.target.style.color = '#f87171' }}
        >
          Logout Secara Aman →
        </button>
      </section>
    </main>
  )
}
