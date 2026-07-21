import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cpuData, gpuData } from '../utils/hardwareMatcher'

const MAX_CPU = Math.max(...cpuData.map(c => c.perf_score))
const MAX_GPU = Math.max(...gpuData.map(g => g.perf_score))

const TIERS = [
  { label: 'Enthusiast', min: 0.75, color: '#f0abfc', glow: '#d946ef' },
  { label: 'High-End',   min: 0.45, color: '#22d3ee', glow: '#06b6d4' },
  { label: 'Mid-Range',  min: 0.22, color: '#4ade80', glow: '#22c55e' },
  { label: 'Budget',     min: 0.08, color: '#fbbf24', glow: '#f59e0b' },
  { label: 'Legacy',     min: 0.00, color: '#94a3b8', glow: '#64748b' },
]

function getTier(score, max) {
  const r = score / max
  return TIERS.find(t => r >= t.min) || TIERS[TIERS.length - 1]
}

function brandColor(brand) {
  if (brand === 'NVIDIA') return '#76b900'
  if (brand === 'AMD')    return '#ed1c24'
  if (brand === 'Intel')  return '#0071c5'
  if (brand === 'Apple')  return '#888'
  return '#94a3b8'
}

function PerfBar({ score, max, color }) {
  const pct = Math.round((score / max) * 100)
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${pct}%`,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        borderRadius: 3,
        transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
        boxShadow: `0 0 8px ${color}66`,
      }} />
    </div>
  )
}

function HardwareCard({ item, max, type, selected, onSelect }) {
  const tier = getTier(item.perf_score, max)
  const bc = brandColor(item.brand)
  const pct = Math.round((item.perf_score / max) * 100)
  const isSelected = selected?.name === item.name

  return (
    <div
      onClick={() => onSelect(isSelected ? null : item)}
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${tier.color}18, var(--bg2))`
          : 'var(--bg2)',
        border: `1px solid ${isSelected ? tier.color + '88' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: isSelected ? `0 0 20px ${tier.glow}22` : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isSelected && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${tier.color}, ${tier.glow})`,
        }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.62rem', color: bc, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{item.brand}</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{item.release_year}</span>
            <span style={{
              fontSize: '0.6rem', padding: '1px 6px', borderRadius: 100,
              background: tier.color + '18', border: `1px solid ${tier.color}44`,
              color: tier.color, fontWeight: 700,
            }}>{tier.label}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: tier.color }}>{pct}%</div>
          <div style={{ fontSize: '0.58rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{item.perf_score.toLocaleString()}</div>
        </div>
      </div>
      <PerfBar score={item.perf_score} max={max} color={tier.color} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {type === 'cpu' ? (
          <>
            <span style={statStyle}>{item.cores}C/{item.threads}T</span>
            <span style={statStyle}>{item.boost_clock} GHz</span>
            {item.family && <span style={statStyle}>{item.family}</span>}
          </>
        ) : (
          <>
            <span style={statStyle}>{item.vram > 0 ? `${item.vram}GB` : 'iGPU'}</span>
            <span style={statStyle}>{item.memory_type}</span>
            <span style={statStyle}>{item.architecture}</span>
          </>
        )}
      </div>
    </div>
  )
}

const statStyle = {
  fontSize: '0.62rem',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text3)',
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '2px 6px',
}

function ComparePanel({ a, b, type, max }) {
  if (!a && !b) return null
  const items = [a, b].filter(Boolean)

  return (
    <div style={{
      background: 'rgba(0,212,255,0.04)',
      border: '1px solid rgba(0,212,255,0.2)',
      borderRadius: 14,
      padding: '1.5rem',
      marginBottom: '2rem',
    }}>
      <div style={{ fontFamily: 'var(--font-secondary)', fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent)', letterSpacing: '0.05em', marginBottom: '1rem' }}>
        PERBANDINGAN {items.length === 2 ? '— HEAD TO HEAD' : '— PILIH SATU LAGI'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: items.length === 2 ? '1fr auto 1fr' : '1fr', gap: '1rem', alignItems: 'center' }}>
        {items.length === 2 ? (
          <>
            <CompareCard item={a} max={max} type={type} side="left" winner={a.perf_score >= b.perf_score} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '1.2rem', color: 'var(--text3)' }}>VS</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                {Math.round((Math.max(a.perf_score, b.perf_score) / Math.min(a.perf_score, b.perf_score) - 1) * 100)}% faster
              </div>
            </div>
            <CompareCard item={b} max={max} type={type} side="right" winner={b.perf_score > a.perf_score} />
          </>
        ) : (
          <CompareCard item={a} max={max} type={type} side="left" winner={false} />
        )}
      </div>
    </div>
  )
}

function CompareCard({ item, max, type, side, winner }) {
  const tier = getTier(item.perf_score, max)
  const pct = Math.round((item.perf_score / max) * 100)
  return (
    <div style={{
      background: winner ? tier.color + '10' : 'var(--bg2)',
      border: `1px solid ${winner ? tier.color + '55' : 'var(--border)'}`,
      borderRadius: 10, padding: '1rem',
      textAlign: side === 'right' ? 'right' : 'left',
    }}>
      {winner && <div style={{ fontSize: '0.65rem', color: tier.color, fontWeight: 700, marginBottom: 6 }}>LEBIH CEPAT</div>}
      <div style={{ fontFamily: 'var(--font-secondary)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)', marginBottom: 4 }}>{item.name}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 900, color: tier.color, marginBottom: 6 }}>
        {pct}%
      </div>
      <PerfBar score={item.perf_score} max={max} color={tier.color} />
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {type === 'cpu' ? (
          <>
            <StatRow label="Cores/Threads" value={`${item.cores}C / ${item.threads}T`} side={side} />
            <StatRow label="Boost Clock" value={`${item.boost_clock} GHz`} side={side} />
            <StatRow label="Base Clock" value={`${item.base_clock} GHz`} side={side} />
            <StatRow label="Year" value={item.release_year} side={side} />
          </>
        ) : (
          <>
            <StatRow label="VRAM" value={item.vram > 0 ? `${item.vram} GB` : 'Integrated'} side={side} />
            <StatRow label="Memory" value={item.memory_type} side={side} />
            <StatRow label="Bus Width" value={item.bus_width > 0 ? `${item.bus_width}-bit` : 'Shared'} side={side} />
            <StatRow label="Architecture" value={item.architecture} side={side} />
            <StatRow label="Year" value={item.release_year} side={side} />
          </>
        )}
      </div>
    </div>
  )
}

function StatRow({ label, value, side }) {
  return (
    <div style={{ display: 'flex', justifyContent: side === 'right' ? 'flex-end' : 'flex-start', gap: 8, fontSize: '0.72rem' }}>
      <span style={{ color: 'var(--text3)' }}>{label}:</span>
      <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  )
}

export default function HardwareHierarchy() {
  const nav = useNavigate()
  const user = (() => { try { return JSON.parse(localStorage.getItem('user')) } catch { return null } })()

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      nav('/', { replace: true })
    }
  }, [user, nav])

  const [tab, setTab] = useState('gpu')
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('All')
  const [tierFilter, setTierFilter] = useState('All')
  const [sortBy, setSortBy] = useState('perf_score')
  const [selectedA, setSelectedA] = useState(null)
  const [selectedB, setSelectedB] = useState(null)

  // Block render until auth confirmed
  if (!user || user.role !== 'admin') return null

  const data   = tab === 'cpu' ? cpuData : gpuData
  const maxVal = tab === 'cpu' ? MAX_CPU  : MAX_GPU

  const brands = useMemo(() => {
    const b = [...new Set(data.map(d => d.brand))].sort()
    return ['All', ...b]
  }, [data])

  const filtered = useMemo(() => {
    let list = [...data]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d => d.name.toLowerCase().includes(q))
    }
    if (brandFilter !== 'All') list = list.filter(d => d.brand === brandFilter)
    if (tierFilter !== 'All')  list = list.filter(d => getTier(d.perf_score, maxVal).label === tierFilter)
    list.sort((a, b) => sortBy === 'perf_score' ? b.perf_score - a.perf_score : b.release_year - a.release_year)
    return list
  }, [data, search, brandFilter, tierFilter, sortBy, maxVal])

  const handleSelect = (item) => {
    if (!item) { setSelectedA(null); setSelectedB(null); return }
    if (!selectedA) { setSelectedA(item); return }
    if (selectedA.name === item.name) { setSelectedA(selectedB); setSelectedB(null); return }
    if (!selectedB) { setSelectedB(item); return }
    if (selectedB.name === item.name) { setSelectedB(null); return }
    setSelectedA(item); setSelectedB(null)
  }

  const btnStyle = (active) => ({
    fontFamily: 'var(--font-primary)',
    letterSpacing: '0.04em',
    padding: '8px 22px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700,
    cursor: 'pointer', transition: 'all 0.15s',
    background: active ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--bg2)',
    border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
    color: active ? '#000' : 'var(--text2)',
  })

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 2rem', animation: 'fadeUp 0.5s ease' }}>
      {/* Hero */}
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
          letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase',
          background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 100, padding: '4px 16px', marginBottom: 16,
        }}>Hardware Performance Database</div>
        <h1 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '0.02em', marginBottom: 12 }}>
          CPU & GPU <span style={{ color: 'var(--accent)' }}>Hierarchy</span>
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, color: 'var(--text2)', fontSize: '0.95rem', maxWidth: 560, margin: '0 auto' }}>
          Database lengkap dari era 2000 hingga 2025. Klik kartu untuk membandingkan hingga 2 hardware secara head-to-head.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {TIERS.map(t => (
            <span key={t.label} style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 100, background: t.color + '18', border: `1px solid ${t.color}44`, color: t.color, fontWeight: 700 }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '2rem' }}>
        <button id="tab-gpu" style={btnStyle(tab === 'gpu')} onClick={() => { setTab('gpu'); setSelectedA(null); setSelectedB(null); setSearch(''); setBrandFilter('All') }}>GPU</button>
        <button id="tab-cpu" style={btnStyle(tab === 'cpu')} onClick={() => { setTab('cpu'); setSelectedA(null); setSelectedB(null); setSearch(''); setBrandFilter('All') }}>CPU</button>
      </div>

      {/* Compare Panel */}
      <ComparePanel a={selectedA} b={selectedB} type={tab} max={maxVal} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <input
          id="hw-search"
          type="text"
          placeholder={`Cari ${tab.toUpperCase()}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 200px', padding: '8px 14px', borderRadius: 8,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: '0.85rem', outline: 'none',
          }}
        />
        <select id="hw-brand" value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={selectStyle}>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select id="hw-tier" value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={selectStyle}>
          <option value="All">Semua Tier</option>
          {TIERS.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
        </select>
        <select id="hw-sort" value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
          <option value="perf_score">Urut: Performa</option>
          <option value="release_year">Urut: Tahun Rilis</option>
        </select>
        <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {filtered.length} model
        </span>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {TIERS.map(t => {
          const count = filtered.filter(d => getTier(d.perf_score, maxVal).label === t.label).length
          if (!count) return null
          return (
            <div key={t.label} style={{
              display: 'flex', gap: 6, alignItems: 'center',
              background: 'var(--bg2)', border: `1px solid ${t.color}33`,
              borderRadius: 8, padding: '5px 12px',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>{t.label}</span>
              <span style={{ fontSize: '0.72rem', color: t.color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{count}</span>
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
        {filtered.map(item => (
          <HardwareCard
            key={item.name}
            item={item}
            max={maxVal}
            type={tab}
            selected={selectedA?.name === item.name ? selectedA : selectedB?.name === item.name ? selectedB : null}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          Tidak ada hardware yang cocok dengan filter.
        </div>
      )}

      <p style={{ textAlign: 'center', marginTop: '3rem', fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
        Skor berdasarkan benchmark relatif (PassMark / 3DMark Fire Strike). Data mencakup {cpuData.length} CPU & {gpuData.length} GPU dari 2000–2025.
      </p>
    </main>
  )
}

const selectStyle = {
  padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem',
  background: 'var(--bg2)', border: '1px solid var(--border)',
  color: 'var(--text)', cursor: 'pointer',
}
