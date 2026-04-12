import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const GRADE_INFO = {
  S: { emoji: '🏆', label: 'Sangat Optimal', color: '#22d3ee' },
  A: { emoji: '✅', label: 'Direkomendasikan', color: '#4ade80' },
  B: { emoji: '⚠️', label: 'Bisa (Minimum)', color: '#fbbf24' },
  C: { emoji: '⚡', label: 'Di Bawah Minimum', color: '#fb923c' },
  D: { emoji: '❌', label: 'Tidak Bisa', color: '#f87171' },
}

const cats = ['Semua', 'Game', 'Creative', 'Office', 'Dev', 'Design', 'Engineering', 'Streaming', 'Browser', 'Communication']

function Bar({ pct, color }) {
  return (
    <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: color, borderRadius: 2,
        transition: 'width 0.8s ease',
      }} />
    </div>
  )
}

function SoftwareCard({ sw }) {
  const [open, setOpen] = useState(false)
  const g = GRADE_INFO[sw.result.grade]
  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${open ? sw.result.color + '44' : 'var(--border)'}`,
      borderRadius: 10,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', cursor: 'pointer',
        userSelect: 'none',
      }}>
        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{sw.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4, truncate: true }}>{sw.name}</div>
          <Bar pct={sw.result.totalScore} color={sw.result.color} />
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: '1.1rem',
          color: sw.result.color,
          minWidth: 28,
          textAlign: 'center',
        }}>{sw.result.grade}</div>
        <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          padding: '0 16px 16px',
          borderTop: '1px solid var(--border)',
          paddingTop: 12,
          animation: 'fadeUp 0.2s ease',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: sw.result.color + '18',
            border: `1px solid ${sw.result.color}44`,
            borderRadius: 100, padding: '3px 12px',
            fontSize: '0.75rem', fontWeight: 600, color: sw.result.color,
            marginBottom: 12,
          }}>
            {g.emoji} {g.label} — {sw.result.totalScore}/100 poin
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {sw.result.details.map(d => (
              <div key={d.label} style={{
                background: 'var(--bg3)',
                borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)' }}>{d.label}</span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    color: d.status === 'optimal' ? '#4ade80' : d.status === 'minimum' ? '#fbbf24' : '#f87171'
                  }}>
                    {d.status === 'optimal' ? '✓ OK' : d.status === 'minimum' ? '~ MIN' : '✗ LOW'}
                  </span>
                </div>
                <Bar pct={d.pct} color={d.status === 'optimal' ? '#4ade80' : d.status === 'minimum' ? '#fbbf24' : '#f87171'} />
                <div style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                  Kamu: {d.user} · Min: {d.min} · Rec: {d.rec}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Results() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [results, setResults] = useState([])
  const [stats, setStats] = useState(null)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Semua')
  const [gradeFilter, setGradeFilter] = useState('Semua')
  const [aiLoading, setAiLoading] = useState(false)

  const spec = {
    cpu: params.get('cpu') || 0,
    ram: params.get('ram') || 0,
    vram: params.get('vram') || 0,
    disk: params.get('disk') || 0,
    cpuName: params.get('cpuName') || 'Unknown CPU',
    gpuName: params.get('gpuName') || 'Unknown GPU',
    ramGb: params.get('ram') || 0,
    diskFree: params.get('disk') || 0,
  }

  useEffect(() => {
    if (!spec.cpu) { nav('/manual'); return }

    fetch(`${API}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpu: spec.cpu, ram: spec.ram, vram: spec.vram, disk: spec.disk }),
    })
      .then(r => r.json())
      .then(d => {
        setResults(d.results)
        setStats(d.stats)
        setLoading(false)
        fetchAI(d.stats)
      })
      .catch(() => {
        setLoading(false)
        setSummary('Gagal terhubung ke backend. Pastikan Flask server berjalan di localhost:5000')
      })
  }, [])

  const fetchAI = async (st) => {
    setAiLoading(true)
    try {
      const topGames = results.filter ? '' : ''
      const res = await fetch(`${API}/api/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec, stats: st }),
      })
      const d = await res.json()
      setSummary(d.summary)
    } catch {
      setSummary('AI summary tidak tersedia. Pastikan ANTHROPIC_API_KEY sudah diisi di backend/.env')
    }
    setAiLoading(false)
  }

  const filtered = results.filter(r => {
    const catOk = filter === 'Semua' || r.cat === filter
    const gradeOk = gradeFilter === 'Semua' || r.result.grade === gradeFilter
    return catOk && gradeOk
  })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', animation: 'pulse 1s infinite' }}>⚙ Menganalisis...</div>
    </div>
  )

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 2rem', animation: 'fadeUp 0.5s ease' }}>
      {/* Spec Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.02em', marginBottom: 8 }}>
          Hasil <span style={{ color: 'var(--accent)' }}>Analisis</span>
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'CPU', val: spec.cpuName },
            { label: 'RAM', val: `${spec.ramGb}GB` },
            { label: 'GPU', val: spec.gpuName },
            { label: 'Storage', val: `${spec.diskFree}GB` },
          ].map(({ label, val }) => (
            <span key={label} style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '4px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text2)',
            }}>
              <span style={{ color: 'var(--text3)' }}>{label}:</span> {val}
            </span>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          {[
            { n: stats.canRun, t: stats.total, label: 'Bisa Dijalankan', color: '#4ade80' },
            { n: stats.optimal, t: stats.total, label: 'Performa Optimal', color: '#22d3ee' },
            { n: stats.gamesOk, t: 17, label: 'Game Siap Main', color: '#a78bfa' },
            { n: stats.cantRun, t: stats.total, label: 'Tidak Memadai', color: '#f87171' },
          ].map(({ n, t, label, color }) => (
            <div key={label} style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '1rem', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 700, color, lineHeight: 1 }}>
                {n}<span style={{ fontSize: '0.9rem', color: 'var(--text3)' }}>/{t}</span>
              </div>
              <div style={{ color: 'var(--text2)', fontSize: '0.78rem', marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* AI Summary */}
      <div style={{
        background: 'rgba(0,212,255,0.05)',
        border: '1px solid rgba(0,212,255,0.2)',
        borderRadius: 12, padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
          letterSpacing: '0.12em', color: 'var(--accent)',
          textTransform: 'uppercase', marginBottom: 10,
        }}>🤖 Ringkasan AI</div>
        {aiLoading ? (
          <div style={{ color: 'var(--text2)', animation: 'pulse 1.2s infinite', fontSize: '0.9rem' }}>
            Claude sedang menganalisis...
          </div>
        ) : (
          <p style={{ color: 'var(--text)', lineHeight: 1.7, fontSize: '0.95rem' }}>{summary}</p>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {cats.filter(c => c === 'Semua' || results.some(r => r.cat === c)).map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              padding: '5px 14px',
              borderRadius: 100,
              fontSize: '0.78rem',
              fontWeight: 600,
              background: filter === c ? 'rgba(0,212,255,0.12)' : 'var(--bg2)',
              border: `1px solid ${filter === c ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
              color: filter === c ? 'var(--accent)' : 'var(--text2)',
              transition: 'all 0.15s',
            }}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Semua', 'S', 'A', 'B', 'C', 'D'].map(g => (
            <button key={g} onClick={() => setGradeFilter(g)} style={{
              padding: '5px 12px',
              borderRadius: 100,
              fontSize: '0.78rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              background: gradeFilter === g ? (GRADE_INFO[g]?.color || 'var(--accent)') + '20' : 'var(--bg2)',
              border: `1px solid ${gradeFilter === g ? (GRADE_INFO[g]?.color || 'var(--accent)') + '60' : 'var(--border)'}`,
              color: gradeFilter === g ? (GRADE_INFO[g]?.color || 'var(--accent)') : 'var(--text2)',
              transition: 'all 0.15s',
            }}>{g}</button>
          ))}
        </div>
      </div>

      {/* Results Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
        {filtered.map(sw => <SoftwareCard key={sw.id} sw={sw} />)}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          Tidak ada software untuk filter ini.
        </div>
      )}

      <button onClick={() => nav('/manual')} style={{
        display: 'block',
        margin: '2rem auto 0',
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text2)',
        padding: '10px 28px',
        borderRadius: 8,
        fontWeight: 600,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}>
        ← Ubah Spesifikasi
      </button>
    </main>
  )
}
