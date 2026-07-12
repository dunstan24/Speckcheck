import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const cpuOptions = [
  { label: 'Intel Core i3-10100 (4C/8T) ~3400 MHz', value: 3400, name: 'Intel Core i3-10100' },
  { label: 'Intel Core i5-10400 (6C/12T) ~4300 MHz', value: 4300, name: 'Intel Core i5-10400' },
  { label: 'Intel Core i5-12600K (10C) ~4900 MHz', value: 4900, name: 'Intel Core i5-12600K' },
  { label: 'Intel Core i7-10700K (8C/16T) ~5100 MHz', value: 5100, name: 'Intel Core i7-10700K' },
  { label: 'Intel Core i7-13700K (16C) ~5400 MHz', value: 5400, name: 'Intel Core i7-13700K' },
  { label: 'Intel Core i9-13900K (24C) ~5800 MHz', value: 5800, name: 'Intel Core i9-13900K' },
  { label: 'AMD Ryzen 3 3300X (4C/8T) ~3800 MHz', value: 3800, name: 'AMD Ryzen 3 3300X' },
  { label: 'AMD Ryzen 5 5600X (6C/12T) ~4600 MHz', value: 4600, name: 'AMD Ryzen 5 5600X' },
  { label: 'AMD Ryzen 7 5800X (8C/16T) ~4700 MHz', value: 4700, name: 'AMD Ryzen 7 5800X' },
  { label: 'AMD Ryzen 9 5900X (12C) ~4800 MHz', value: 4800, name: 'AMD Ryzen 9 5900X' },
  { label: 'AMD Ryzen 9 7950X (16C) ~5700 MHz', value: 5700, name: 'AMD Ryzen 9 7950X' },
  { label: 'Intel Celeron / Pentium ~2000 MHz', value: 2000, name: 'Intel Celeron/Pentium' },
  { label: 'Laptop Low-end (Atom/Celeron) ~1200 MHz', value: 1200, name: 'Laptop Low-end CPU' },
]

const gpuOptions = [
  { label: 'Intel HD / UHD (Integrated) 0 GB VRAM', value: 0, name: 'Intel HD/UHD Integrated' },
  { label: 'NVIDIA GT 1030 2 GB VRAM', value: 2, name: 'NVIDIA GeForce GT 1030' },
  { label: 'NVIDIA GTX 1050 Ti 4 GB VRAM', value: 4, name: 'NVIDIA GeForce GTX 1050 Ti' },
  { label: 'NVIDIA GTX 1060 6 GB VRAM', value: 6, name: 'NVIDIA GeForce GTX 1060' },
  { label: 'NVIDIA GTX 1660 Super 6 GB VRAM', value: 6, name: 'NVIDIA GeForce GTX 1660 Super' },
  { label: 'NVIDIA RTX 2060 6 GB VRAM', value: 6, name: 'NVIDIA GeForce RTX 2060' },
  { label: 'NVIDIA RTX 3060 12 GB VRAM', value: 12, name: 'NVIDIA GeForce RTX 3060' },
  { label: 'NVIDIA RTX 3070 8 GB VRAM', value: 8, name: 'NVIDIA GeForce RTX 3070' },
  { label: 'NVIDIA RTX 3080 10 GB VRAM', value: 10, name: 'NVIDIA GeForce RTX 3080' },
  { label: 'NVIDIA RTX 4070 12 GB VRAM', value: 12, name: 'NVIDIA GeForce RTX 4070' },
  { label: 'NVIDIA RTX 4090 24 GB VRAM', value: 24, name: 'NVIDIA GeForce RTX 4090' },
  { label: 'AMD RX 570 4 GB VRAM', value: 4, name: 'AMD Radeon RX 570' },
  { label: 'AMD RX 580 8 GB VRAM', value: 8, name: 'AMD Radeon RX 580' },
  { label: 'AMD RX 6700 XT 12 GB VRAM', value: 12, name: 'AMD Radeon RX 6700 XT' },
  { label: 'AMD RX 7900 XTX 24 GB VRAM', value: 24, name: 'AMD Radeon RX 7900 XTX' },
]

export default function TestPC() {
  const nav = useNavigate()
  const [downloading, setDownloading] = useState(false)
  const [savedSpec, setSavedSpec] = useState(null)
  const [user, setUser] = useState(null)

  const [form, setForm] = useState({
    cpuIdx: '',
    gpuIdx: '',
    ram: '',
    disk: '',
  })

  useEffect(() => {
    // Load user
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try { setUser(JSON.parse(userStr)) } catch {}
    }

    // Load spec
    const loadSpec = async () => {
      if (userStr) {
        try {
          const u = JSON.parse(userStr)
          const res = await fetch(`${API}/api/user/spec`, {
            headers: { 'Authorization': String(u.token || '') }
          })
          if (res.status === 401) {
            localStorage.removeItem('user')
            localStorage.removeItem('user_spec')
            window.dispatchEvent(new Event('authChange'))
            return
          }
          const data = await res.json()
          if (data.spec) {
            localStorage.setItem('user_spec', JSON.stringify(data.spec))
            setSavedSpec(data.spec)
            return
          }
        } catch (err) {
          console.error('Failed to fetch spec from DB:', err)
        }
      }
      try {
        const spec = localStorage.getItem('user_spec')
        if (spec) setSavedSpec(JSON.parse(spec))
      } catch {}
    }
    loadSpec()
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`${API}/api/download-detector`)
      if (!res.ok) throw new Error('not available')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'BisaMainNggakYa_Detect.exe'
      a.click()
    } catch {
      alert('File detector belum tersedia. Silakan gunakan form Input Manual di sebelah kanan.')
    } finally {
      setDownloading(false)
    }
  }

  const handleRunSavedSpec = () => {
    if (!savedSpec) return
    const p = new URLSearchParams({
      cpu: String(savedSpec.cpu || 0),
      ram: String(savedSpec.ram || 0),
      vram: String(savedSpec.vram || 0),
      disk: String(savedSpec.disk || 0),
      cpuName: savedSpec.cpuName || '',
      gpuName: savedSpec.gpuName || '',
      os: savedSpec.os || 'Windows'
    })
    nav(`/results?${p}`)
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    const { cpuIdx, gpuIdx, ram, disk } = form
    if (cpuIdx === '' || gpuIdx === '' || !ram || !disk) {
      alert('Mohon lengkapi semua spesifikasi PC Anda!')
      return
    }

    const selectedCpu = cpuOptions[Number(cpuIdx)]
    const selectedGpu = gpuOptions[Number(gpuIdx)]

    const cpuVal = selectedCpu.value
    const ramVal = Number(ram)
    const vramVal = selectedGpu.value
    const diskVal = Number(disk)
    const cpuNameVal = selectedCpu.name
    const gpuNameVal = selectedGpu.name

    // Save locally
    localStorage.setItem('user_spec', JSON.stringify({
      cpu: cpuVal,
      ram: ramVal,
      vram: vramVal,
      disk: diskVal,
      cpuName: cpuNameVal,
      gpuName: gpuNameVal,
      os: 'Windows'
    }))

    // Save to DB if logged in
    if (user) {
      fetch(`${API}/api/user/spec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': String(user.token || '')
        },
        body: JSON.stringify({
          cpu: cpuVal,
          ram: ramVal,
          vram: vramVal,
          disk: diskVal,
          cpuName: cpuNameVal,
          gpuName: gpuNameVal,
          os: 'Windows'
        })
      }).catch(err => console.error('Gagal menyimpan spec ke DB:', err))
    }

    const p = new URLSearchParams({
      cpu: String(cpuVal),
      ram: String(ramVal),
      vram: String(vramVal),
      disk: String(diskVal),
      cpuName: cpuNameVal,
      gpuName: gpuNameVal
    })
    nav(`/results?${p}`, { state: { justSaved: true } })
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 2rem 4rem' }}>
      <section style={{
        textAlign: 'center',
        marginBottom: '2.5rem',
        animation: 'fadeUp 0.5s ease',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', lineHeight: 1.15,
          letterSpacing: '-0.025em', marginBottom: '1rem',
        }}>
          🔬 Test Your <span style={{ color: 'var(--accent)' }}>PC Spec</span>
        </h1>
        <p style={{
          fontSize: '0.92rem', color: 'var(--text2)', lineHeight: 1.7,
          maxWidth: 650, margin: '0 auto',
        }}>
          Pilih salah satu metode di bawah untuk menganalisis kecocokan spesifikasi PC Anda dengan ribuan game. Anda bisa mendeteksi secara otomatis atau memasukkan komponen secara manual.
        </p>
      </section>

      {/* Main Testing Panel */}
      <section style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '2rem',
        marginBottom: '3rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animation: 'fadeUp 0.5s 0.1s ease both',
      }}>
        {savedSpec && (
          <div style={{
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ fontSize: '0.85rem' }}>
              <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Spesifikasi Tersimpan:</span> {savedSpec.cpuName} | {savedSpec.gpuName} | {savedSpec.ram}GB RAM
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleRunSavedSpec} style={{
                background: 'var(--accent)', color: '#000', border: 'none',
                fontWeight: 700, fontSize: '0.78rem', padding: '6px 14px', borderRadius: 4, cursor: 'pointer'
              }}>Gunakan Spesifikasi Ini</button>
              <button onClick={() => { localStorage.removeItem('user_spec'); setSavedSpec(null) }} style={{
                background: 'transparent', color: 'var(--text3)', border: 'none',
                fontSize: '0.78rem', cursor: 'pointer'
              }}>Hapus</button>
            </div>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: '2.5rem',
          alignItems: 'start'
        }}>
          {/* Left Side: Auto Program Download */}
          <div style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '1.5rem',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚡</span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Deteksi Otomatis</h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Gunakan aplikasi detektor ringan kami (.exe) untuk memindai spesifikasi hardware PC Anda secara otomatis dalam 1 detik. Aman, portabel, tanpa instalasi.
              </p>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: '1.5rem' }}>
                Langkah:<br />
                1. Unduh file program detector<br />
                2. Jalankan di komputer Anda<br />
                3. Browser akan otomatis memuat hasil analisis!
              </div>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: '#000',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                padding: '12px 20px',
                borderRadius: 8,
                cursor: 'pointer',
                opacity: downloading ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {downloading ? '⏳ Mengunduh...' : '↓ Download Detector (.exe)'}
            </button>
          </div>

          {/* Right Side: Manual Input Form */}
          <form onSubmit={handleManualSubmit} style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.25rem' }}>✍</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Input Manual</h3>
            </div>

            {/* CPU Selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 6 }}>Prosesor (CPU)</label>
              <select
                required
                value={form.cpuIdx}
                onChange={e => setForm(f => ({ ...f, cpuIdx: e.target.value }))}
                style={{
                  width: '100%', padding: '10px', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text)', fontSize: '0.82rem', outline: 'none'
                }}
              >
                <option value="">-- Pilih CPU --</option>
                {cpuOptions.map((opt, idx) => (
                  <option key={idx} value={idx}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* GPU Selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 6 }}>Kartu Grafis (GPU)</label>
              <select
                required
                value={form.gpuIdx}
                onChange={e => setForm(f => ({ ...f, gpuIdx: e.target.value }))}
                style={{
                  width: '100%', padding: '10px', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text)', fontSize: '0.82rem', outline: 'none'
                }}
              >
                <option value="">-- Pilih GPU --</option>
                {gpuOptions.map((opt, idx) => (
                  <option key={idx} value={idx}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* RAM & Disk Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 6 }}>Memori RAM (GB)</label>
                <input
                  required
                  type="number"
                  placeholder="Contoh: 16"
                  min="1"
                  max="128"
                  value={form.ram}
                  onChange={e => setForm(f => ({ ...f, ram: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 6, color: 'var(--text)', fontSize: '0.82rem', outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 6 }}>Storage Tersedia (GB)</label>
                <input
                  required
                  type="number"
                  placeholder="Contoh: 100"
                  min="1"
                  max="10000"
                  value={form.disk}
                  onChange={e => setForm(f => ({ ...f, disk: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 6, color: 'var(--text)', fontSize: '0.82rem', outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                padding: '12px 20px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Cek Kompatibilitas PC →
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
