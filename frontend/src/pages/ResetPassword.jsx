import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const token = params.get('token') || ''
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.password || !form.confirmPassword) {
      setError('Semua field wajib diisi')
      return
    }
    if (form.password.length < 8) {
      setError('Password minimal 8 karakter')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Password dan konfirmasi tidak cocok')
      return
    }
    if (!token) {
      setError('Token reset tidak ditemukan di URL.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: form.password })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan')
      }
      // Hapus data login lama — sesi telah diinvalidasi oleh token_version increment
      localStorage.removeItem('user')
      localStorage.removeItem('user_spec')
      window.dispatchEvent(new Event('authChange'))
      setSuccess(true)
      setTimeout(() => nav('/login'), 3000)
    } catch (err) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setError('Maaf, server sedang tidak dapat dihubungi. Silakan coba beberapa saat lagi.')
      } else {
        setError(err.message || 'Terjadi kesalahan')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      maxWidth: 440,
      margin: '4rem auto',
      padding: '0 1.5rem',
      animation: 'fadeUp 0.5s ease'
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '2.5rem 2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '1.8rem',
            letterSpacing: '-0.02em',
            marginTop: '0.5rem',
            marginBottom: '0.5rem'
          }}>
            Reset <span style={{ color: 'var(--accent2)' }}>Password</span>
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
            Buat password baru untuk akun Anda
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            fontFamily: 'var(--font-mono)'
          }}>
            {error}
          </div>
        )}

        {success ? (
          <div style={{
            background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            borderRadius: 8,
            padding: '14px',
            color: '#4ade80',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            Password berhasil direset! Anda akan diarahkan ke halaman login...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                color: 'var(--text2)',
                textTransform: 'uppercase',
                marginBottom: 6
              }}>Password Baru</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Minimal 8 karakter"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent2)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                color: 'var(--text2)',
                textTransform: 'uppercase',
                marginBottom: 6
              }}>Konfirmasi Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Ulangi password baru"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent2)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, var(--accent2), #a78bfa)',
                color: '#000',
                fontWeight: 700,
                fontSize: '0.95rem',
                padding: '14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'transform 0.15s, opacity 0.15s',
              }}
              onMouseEnter={e => e.target.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
            >
              {loading ? 'Memproses...' : 'Simpan Password Baru →'}
            </button>
          </form>
        )}

        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text3)'
        }}>
          <Link to="/login" style={{ color: 'var(--accent2)', fontWeight: 600 }}>
            ← Kembali ke Login
          </Link>
        </div>
      </div>
    </main>
  )
}
