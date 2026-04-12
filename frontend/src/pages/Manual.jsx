import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const cpuOptions = [
  { label: 'Intel Core i3-10100 (4C/8T) ~3400 MHz', value: 3400 },
  { label: 'Intel Core i5-10400 (6C/12T) ~4300 MHz', value: 4300 },
  { label: 'Intel Core i5-12600K (10C) ~4900 MHz', value: 4900 },
  { label: 'Intel Core i7-10700K (8C/16T) ~5100 MHz', value: 5100 },
  { label: 'Intel Core i7-13700K (16C) ~5400 MHz', value: 5400 },
  { label: 'Intel Core i9-13900K (24C) ~5800 MHz', value: 5800 },
  { label: 'AMD Ryzen 3 3300X (4C/8T) ~3800 MHz', value: 3800 },
  { label: 'AMD Ryzen 5 5600X (6C/12T) ~4600 MHz', value: 4600 },
  { label: 'AMD Ryzen 7 5800X (8C/16T) ~4700 MHz', value: 4700 },
  { label: 'AMD Ryzen 9 5900X (12C) ~4800 MHz', value: 4800 },
  { label: 'AMD Ryzen 9 7950X (16C) ~5700 MHz', value: 5700 },
  { label: 'Intel Celeron / Pentium ~2000 MHz', value: 2000 },
  { label: 'Laptop Low-end (Atom/Celeron) ~1200 MHz', value: 1200 },
]

const gpuOptions = [
  { label: 'Intel HD / UHD (Integrated) 0 GB VRAM', value: 0 },
  { label: 'NVIDIA GT 1030 2 GB VRAM', value: 2 },
  { label: 'NVIDIA GTX 1050 Ti 4 GB VRAM', value: 4 },
  { label: 'NVIDIA GTX 1060 6 GB VRAM', value: 6 },
  { label: 'NVIDIA GTX 1660 Super 6 GB VRAM', value: 6 },
  { label: 'NVIDIA RTX 2060 6 GB VRAM', value: 6 },
  { label: 'NVIDIA RTX 3060 12 GB VRAM', value: 12 },
  { label: 'NVIDIA RTX 3070 8 GB VRAM', value: 8 },
  { label: 'NVIDIA RTX 3080 10 GB VRAM', value: 10 },
  { label: 'NVIDIA RTX 4070 12 GB VRAM', value: 12 },
  { label: 'NVIDIA RTX 4090 24 GB VRAM', value: 24 },
  { label: 'AMD RX 570 4 GB VRAM', value: 4 },
  { label: 'AMD RX 580 8 GB VRAM', value: 8 },
  { label: 'AMD RX 6700 XT 12 GB VRAM', value: 12 },
  { label: 'AMD RX 7900 XTX 24 GB VRAM', value: 24 },
]

export default function Manual() {
  const nav = useNavigate()
  const [form, setForm] = useState({ cpu: '', ram: '', vram: '', disk: '', cpuName: '', gpuName: '' })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.cpu || !form.ram || form.vram === '' || !form.disk) {
      alert('Lengkapi semua field!')
      return
    }
    const p = new URLSearchParams({
      cpu: form.cpu, ram: form.ram, vram: form.vram, disk: form.disk,
      cpuName: form.cpuName || `${form.cpu} MHz`,
      gpuName: form.gpuName || `${form.vram}GB VRAM`,
    })
    nav(`/results?${p}`)
  }

  const field = (label, hint, children) => (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        letterSpacing: '0.1em',
        color: 'var(--text2)',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
        {hint && <span style={{ color: 'var(--text3)', marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '4rem 2rem', animation: 'fadeUp 0.5s ease' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.02em', marginBottom: 8 }}>
          Input <span style={{ color: 'var(--accent)' }}>Spesifikasi</span> Manual
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>
          Isi spesifikasi PC kamu. Semua field wajib diisi.
        </p>
      </div>

      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '2rem',
      }}>
        {field('Prosesor (CPU)', '',
          <select value={form.cpu} onChange={e => {
            const opt = cpuOptions.find(o => String(o.value) === e.target.value)
            set('cpu', e.target.value)
            set('cpuName', opt ? opt.label.split(' ~')[0] : '')
          }}>
            <option value="">-- Pilih CPU --</option>
            {cpuOptions.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
          </select>
        )}

        {field('RAM', '(GB)',
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[4, 8, 16, 32, 64].map(n => (
              <button key={n} onClick={() => set('ram', n)} style={{
                padding: '10px 0',
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '0.95rem',
                background: form.ram == n ? 'rgba(0,212,255,0.15)' : 'var(--bg3)',
                border: `1px solid ${form.ram == n ? 'var(--accent)' : 'var(--border)'}`,
                color: form.ram == n ? 'var(--accent)' : 'var(--text2)',
                transition: 'all 0.15s',
              }}>{n}GB</button>
            ))}
          </div>
        )}

        {field('Kartu Grafis (GPU)', '',
          <select value={form.vram} onChange={e => {
            const opt = gpuOptions.find(o => String(o.value) === e.target.value && o.label.includes(e.target.options[e.target.selectedIndex].text.split(' ')[0]))
            set('vram', e.target.value)
            set('gpuName', e.target.options[e.target.selectedIndex].text.split(' (')[0].split(' 0 GB')[0].split(' 2 GB')[0].split(' 4 GB')[0].split(' 6 GB')[0].split(' 8 GB')[0].split(' 10 GB')[0].split(' 12 GB')[0].split(' 24 GB')[0])
          }}>
            <option value="">-- Pilih GPU --</option>
            {gpuOptions.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
          </select>
        )}

        {field('Storage Tersedia', '(GB ruang kosong)',
          <input
            type="number"
            placeholder="Contoh: 100"
            value={form.disk}
            onChange={e => set('disk', e.target.value)}
            min={0} max={10000}
          />
        )}

        <button onClick={handleSubmit} style={{
          width: '100%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          color: '#fff',
          fontWeight: 700,
          fontSize: '1rem',
          padding: '14px',
          borderRadius: 8,
          marginTop: '0.5rem',
          transition: 'opacity 0.15s',
          letterSpacing: '0.02em',
        }}>
          Analisis Sekarang →
        </button>
      </div>

      <p style={{
        marginTop: '1.5rem',
        textAlign: 'center',
        color: 'var(--text3)',
        fontSize: '0.8rem',
        fontFamily: 'var(--font-mono)',
      }}>
        Tidak tahu spek PC? Gunakan tombol Deteksi Otomatis di halaman utama.
      </p>
    </main>
  )
}
