import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function Login() {
  const nav = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const googleBtnRef = useRef(null)

  // Auto-save spec ke DB setelah login sukses (Alur B)
  const autoSaveSpec = useCallback(async (token) => {
    try {
      const localSpec = localStorage.getItem('user_spec')
      if (localSpec) {
        await fetch(`${API}/api/user/spec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': String(token || ''),
          },
          body: localSpec,
        })
      }
    } catch (err) {
      console.error('Auto-save spec gagal:', err)
    }
  }, [])

  // Fetch spec dari DB setelah login sukses
  const fetchAndSaveSpec = useCallback(async (token) => {
    try {
      const specRes = await fetch(`${API}/api/user/spec`, {
        headers: { 'Authorization': String(token || '') }
      })
      const specData = await specRes.json()
      if (specData.spec) {
        localStorage.setItem('user_spec', JSON.stringify(specData.spec))
      }
    } catch (err) {
      console.error('Fetch spec gagal:', err)
    }
  }, [])

  const handleLoginSuccess = useCallback(async (userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    // Cek apakah ada spec di localStorage yang belum tersimpan ke DB
    const localSpec = localStorage.getItem('user_spec')
    if (localSpec) {
      await autoSaveSpec(userData.token)
    }
    // Fetch spec dari DB (mungkin ada dari sesi sebelumnya)
    await fetchAndSaveSpec(userData.token)
    // Redirect
    if (userData.role === 'admin') {
      nav('/admin')
    } else {
      nav('/')
    }
    window.dispatchEvent(new Event('authChange'))
  }, [nav, autoSaveSpec, fetchAndSaveSpec])

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
            if (!res.ok) throw new Error(data.error || 'Login Google gagal')
            await handleLoginSuccess(data.user)
          } catch (err) {
            if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
              setError('Maaf, server sedang tidak dapat dihubungi. Silakan coba beberapa saat lagi.')
            } else {
              setError(err.message || 'Login Google gagal')
            }
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
          text: 'signin_with',
          shape: 'rectangular',
        })
      }
    }
    // Google script mungkin belum load, retry
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
  }, [handleLoginSuccess])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.username.trim() || !form.password.trim()) {
      setError('Username/email dan password harus diisi')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan')
      }
      await handleLoginSuccess(data.user)
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
            fontFamily: 'var(--font-primary)',
            fontWeight: 700,
            fontSize: '2.2rem',
            letterSpacing: '0.02em',
            marginTop: '0.5rem',
            marginBottom: '0.5rem'
          }}>
            Selamat <span style={{ color: 'var(--accent)' }}>Datang</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text2)', fontSize: '0.9rem' }}>
            Masuk untuk menyimpan spesifikasi PC kamu
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

        {/* Google Sign-In Button */}
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
            }}>Username atau Email</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Masukkan username atau email"
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
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            />
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
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
              placeholder="Masukkan password"
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
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Forgot Password — selalu tampil */}
          <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
            <Link to="/forgot-password" style={{
              color: 'var(--accent)',
              fontSize: '0.78rem',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => e.target.style.opacity = '0.7'}
            onMouseLeave={e => e.target.style.opacity = '1'}
            >
              Lupa Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
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
            {loading ? '⏳ Memproses...' : 'Masuk →'}
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text3)'
        }}>
          Belum punya akun?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Daftar Sekarang
          </Link>
        </div>
      </div>
    </main>
  )
}
