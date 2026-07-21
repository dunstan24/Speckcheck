import { useState } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!identifier.trim()) return
    setLoading(true)
    try {
      await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, username: identifier })
      })
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
    setSubmitted(true)
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
            Lupa <span style={{ color: 'var(--accent)' }}>Password</span>
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
            Masukkan email atau username akun Anda. Link reset akan dikirim ke email yang terdaftar.
          </p>
        </div>

        {submitted ? (
          <div style={{
            background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            borderRadius: 8,
            padding: '14px',
            color: '#4ade80',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.6,
            textAlign: 'center'
          }}>
            ✅ Jika akun terdaftar dan memiliki email, link reset telah dikirim. Periksa inbox dan folder spam Anda.
            <br/>
            <span style={{ color: 'var(--text3)', fontSize: '0.78rem', display: 'block', marginTop: 8 }}>
              Link berlaku selama 1 jam.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                color: 'var(--text2)',
                textTransform: 'uppercase',
                marginBottom: 6
              }}>Email atau Username</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Masukkan email atau username"
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
              {loading ? 'Mengirim...' : 'Kirim Link Reset →'}
            </button>
          </form>
        )}

        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text3)'
        }}>
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            ← Kembali ke Login
          </Link>
        </div>
      </div>
    </main>
  )
}
