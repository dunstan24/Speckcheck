import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function Home() {
  const nav = useNavigate()
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`${API}/api/download-detector`)
      if (!res.ok) throw new Error('not available')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'SpecCheck_Detect.exe'
      a.click()
    } catch {
      alert('File detector belum tersedia. Gunakan Input Manual.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '5rem 2rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', animation: 'fadeUp 0.6s ease both' }}>
        <div style={{
          display: 'inline-block',
          background: 'rgba(0,212,255,0.08)',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 100,
          padding: '6px 20px',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent)',
          letterSpacing: '0.1em',
          marginBottom: '2rem',
        }}>
          ✦ POWERED BY CLAUDE AI
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          marginBottom: '1.5rem',
        }}>
          <span style={{ color: 'var(--text)' }}>Cek Kompatibilitas</span><br />
          <span style={{ color: 'var(--accent)' }}>PC</span>
          <span style={{ color: 'var(--text)' }}> Kamu dalam</span>
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}> Detik</span>
        </h1>

        <p style={{
          fontSize: '1.1rem',
          color: 'var(--text2)',
          maxWidth: 520,
          margin: '0 auto 3rem',
          lineHeight: 1.7,
        }}>
          Analisis 30 software & game populer. Sistem AI akan memberi grade <strong style={{ color: 'var(--text)' }}>S–D</strong> untuk setiap aplikasi berdasarkan spesifikasi PC-mu.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleDownload} disabled={downloading} style={{
            background: 'linear-gradient(135deg, var(--accent), #0099bb)',
            color: '#000',
            fontWeight: 700,
            fontSize: '1rem',
            padding: '14px 32px',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: downloading ? 0.7 : 1,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
            {downloading ? '⏳ Downloading...' : '⚡ Deteksi Otomatis (.exe)'}
          </button>

          <button onClick={() => nav('/manual')} style={{
            background: 'transparent',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: '1rem',
            padding: '14px 32px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}>
            ✏️ Input Manual
          </button>
        </div>
      </div>

      {/* How it works */}
      <div style={{ marginTop: '6rem', animation: 'fadeUp 0.6s 0.2s ease both', opacity: 0, animationFillMode: 'forwards' }}>
        <h2 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          color: 'var(--text3)',
          textAlign: 'center',
          marginBottom: '2.5rem',
          textTransform: 'uppercase',
        }}>Cara Kerja</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {[
            { step: '01', icon: '🖥️', title: 'Deteksi Spek', desc: 'Download .exe atau isi manual CPU, RAM, GPU, Storage PC kamu' },
            { step: '02', icon: '⚙️', title: 'Analisis Engine', desc: 'Rule-based engine membandingkan dengan syarat 30 software & game' },
            { step: '03', icon: '🤖', title: 'AI Summary', desc: 'Claude AI membuat ringkasan hasil dalam bahasa Indonesia yang mudah dipahami' },
            { step: '04', icon: '📊', title: 'Lihat Grade', desc: 'Dapatkan grade S/A/B/C/D untuk setiap software beserta saran upgrade' },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '1.5rem',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 12, right: 12,
                fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                color: 'var(--text3)',
              }}>{step}</div>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{icon}</div>
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1rem' }}>{title}</h3>
              <p style={{ color: 'var(--text2)', fontSize: '0.875rem', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{
        marginTop: '4rem',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '2rem',
        display: 'flex',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: '1rem',
        animation: 'fadeUp 0.6s 0.4s ease both',
        opacity: 0,
        animationFillMode: 'forwards',
      }}>
        {[
          { n: '30', label: 'Software & Game' },
          { n: '4', label: 'Komponen Dicek' },
          { n: 'S–D', label: 'Grade System' },
          { n: 'AI', label: 'Ringkasan Claude' },
        ].map(({ n, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--accent)',
              lineHeight: 1,
            }}>{n}</div>
            <div style={{ color: 'var(--text2)', fontSize: '0.8rem', marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>
    </main>
  )
}
