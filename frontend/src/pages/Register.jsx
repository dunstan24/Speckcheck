import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function Register() {
  const nav = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const googleBtnRef = useRef(null)

  const handleGoogleSuccess = useCallback(async (userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    window.dispatchEvent(new Event('authChange'))
    nav('/')
  }, [nav])

  // Google Sign-In initialization
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google) return
    const initGoogle = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setError('')
          setLoading(true)
          try {
            const res = await fetch(`${API}/api/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id_token: response.credential })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Registrasi Google gagal')
            await handleGoogleSuccess(data.user)
          } catch (err) {
            setError(err.message)
          } finally {
            setLoading(false)
          }
        }
      })
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'filled_black',
          size: 'large',
          width: '100%',
          text: 'signup_with',
          shape: 'rectangular',
        })
      }
    }
    if (window.google?.accounts?.id) {
      initGoogle()
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer)
          initGoogle()
        }
      }, 200)
      return () => clearInterval(timer)
    }
  }, [handleGoogleSuccess])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.username.trim() || !form.password.trim() || !form.confirmPassword.trim()) {
      setError('Semua field wajib diisi')
      return
    }

    if (form.password.length < 8) {
      setError('Password minimal 8 karakter')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan')
      }
      
      setSuccess('Registrasi berhasil! Mengalihkan ke halaman login...')
      setTimeout(() => {
        nav('/login')
      }, 2000)
    } catch (err) {
      setError(err.message)
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
          <span style={{ fontSize: '2.5rem' }}>✨</span>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '1.8rem',
            letterSpacing: '-0.02em',
            marginTop: '0.5rem',
            marginBottom: '0.5rem'
          }}>
            Buat <span style={{ color: 'var(--accent2)' }}>Akun</span> Baru
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
            Simpan spesifikasi PC kamu setelah mendaftar
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
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#4ade80',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            fontFamily: 'var(--font-mono)'
          }}>
            ✅ {success}
          </div>
        )}

        {/* Google Sign-Up Button */}
        {GOOGLE_CLIENT_ID && (
          <>
            <div ref={googleBtnRef} style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }} />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: '1.25rem',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ color: 'var(--text3)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>ATAU</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          </>
        )}

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
            }}>Username</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Masukkan username baru"
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

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              color: 'var(--text2)',
              textTransform: 'uppercase',
              marginBottom: 6
            }}>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
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
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Ulangi password"
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
            {loading ? '⏳ Mendaftar...' : 'Daftar Sekarang →'}
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text3)'
        }}>
          Sudah punya akun?{' '}
          <Link to="/login" style={{ color: 'var(--accent2)', fontWeight: 600 }}>
            Masuk Di Sini
          </Link>
        </div>
      </div>
    </main>
  )
}
