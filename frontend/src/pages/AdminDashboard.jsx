import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname.includes('bisamainnggak.com') ? 'https://api.bisamainnggak.com' : 'http://localhost:5000');

const btn = (extra = {}) => ({
  border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
  fontSize: '0.78rem', padding: '6px 14px', transition: 'all 0.15s', ...extra
})

export default function AdminDashboard() {
  const nav = useNavigate()
  const [activeTab, setActiveTab] = useState('games')
  const [games, setGames] = useState([])
  const [users, setUsers] = useState([])
  const [newGameReqs, setNewGameReqs] = useState([])
  const [dataReqs, setDataReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [gameFilter, setGameFilter] = useState('all') // 'all', 'incomplete', 'complete', 'empty_all', 'missing_min', 'missing_rec', 'no_cover'
  const [userRoleFilter, setUserRoleFilter] = useState('all') // 'all', 'admin', 'user'
  const [reqFilter, setReqFilter] = useState('all') // 'all', 'new_game', 'data'
  const [page, setPage] = useState(1)
  const pageSize = 25

  // Hardware Autocomplete options
  const [cpuOptions, setCpuOptions] = useState([])
  const [gpuOptions, setGpuOptions] = useState([])

  // Edit email state
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingEmail, setEditingEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  // Game Spec Modal state
  const [selectedGame, setSelectedGame] = useState(null)
  const [gameForm, setGameForm] = useState({
    min_cpu_name: '', min_gpu_name: '',
    min_cpu: '', min_ram: '', min_vram: '', min_disk: '',
    rec_cpu_name: '', rec_gpu_name: '',
    rec_cpu: '', rec_ram: '', rec_vram: '', rec_disk: ''
  })
  const [savingGame, setSavingGame] = useState(false)

  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': String(user?.token || ''),
    'X-User-Role': user?.role || ''
  }

  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery, gameFilter, userRoleFilter, reqFilter, activeTab])

  // Load hardware autocomplete options
  useEffect(() => {
    fetch(`${API}/api/hardware/options`)
      .then(res => res.json())
      .then(data => {
        setCpuOptions(data.cpus || [])
        setGpuOptions(data.gpus || [])
      })
      .catch(err => console.error(err))
  }, [])

  useEffect(() => {
    if (!user || user.role !== 'admin') { nav('/login'); return }
    const fetchData = async () => {
      setLoading(true); setError('')
      try {
        if (activeTab === 'games') {
          const res = await fetch(`${API}/api/admin/games`, { headers })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Gagal mengambil data game')
          setGames(data.games || [])
        } else if (activeTab === 'users') {
          const res = await fetch(`${API}/api/admin/users`, { headers })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Gagal mengambil data user')
          setUsers(data.users || [])
        } else if (activeTab === 'requests') {
          const res = await fetch(`${API}/api/admin/requests`, { headers })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Gagal mengambil request')
          setNewGameReqs(data.new_game_requests || [])
          setDataReqs(data.data_requests || [])
        }
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [activeTab])

  // ── Filter Logics ─────────────────────────────────────────────────────────

  const filteredGames = useMemo(() => {
    return games.filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      const isMinEmpty = !g.min_cpu && !g.min_ram && !g.min_vram && !g.min_disk
      const isMinIncomplete = !g.min_cpu || !g.min_ram || !g.min_vram || !g.min_disk
      const isRecIncomplete = !g.rec_cpu || !g.rec_ram || !g.rec_vram || !g.rec_disk
      const isIncomplete = isMinIncomplete || isRecIncomplete
      const isComplete = !isIncomplete

      if (gameFilter === 'incomplete') return isIncomplete
      if (gameFilter === 'complete') return isComplete
      if (gameFilter === 'empty_all') return isMinEmpty
      if (gameFilter === 'missing_min') return isMinIncomplete
      if (gameFilter === 'missing_rec') return isRecIncomplete
      if (gameFilter === 'no_cover') return !g.cover_image_url
      return true
    })
  }, [games, searchQuery, gameFilter])

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = searchQuery.toLowerCase()
      const matchesSearch = u.username.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q))
      if (!matchesSearch) return false
      if (userRoleFilter !== 'all' && (u.role || 'user') !== userRoleFilter) return false
      return true
    })
  }, [users, searchQuery, userRoleFilter])

  const filteredRequests = useMemo(() => {
    const q = searchQuery.toLowerCase()
    let list = []
    if (reqFilter === 'all' || reqFilter === 'new_game') {
      newGameReqs.forEach(r => list.push({ ...r, type: 'new_game' }))
    }
    if (reqFilter === 'all' || reqFilter === 'data') {
      dataReqs.forEach(r => list.push({ ...r, type: 'data' }))
    }
    return list.filter(r => r.game_name.toLowerCase().includes(q))
  }, [newGameReqs, dataReqs, searchQuery, reqFilter])

  // Pagination slice
  const paginatedGames = useMemo(() => filteredGames.slice((page - 1) * pageSize, page * pageSize), [filteredGames, page])
  const paginatedUsers = useMemo(() => filteredUsers.slice((page - 1) * pageSize, page * pageSize), [filteredUsers, page])
  const paginatedRequests = useMemo(() => filteredRequests.slice((page - 1) * pageSize, page * pageSize), [filteredRequests, page])

  const totalPages = Math.ceil((
    activeTab === 'games' ? filteredGames.length :
    activeTab === 'users' ? filteredUsers.length :
    filteredRequests.length
  ) / pageSize) || 1

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveEmail = async (userId) => {
    if (!editingEmail.trim()) return
    setSavingEmail(true)
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ email: editingEmail.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers(users.map(u => u.id === userId ? { ...u, email: editingEmail.trim() } : u))
      setEditingUserId(null)
    } catch (err) { alert(err.message) }
    finally { setSavingEmail(false) }
  }

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Hapus user "${username}"? Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers(users.filter(u => u.id !== userId))
    } catch (err) { alert(err.message) }
  }

  const openSpecModal = (game) => {
    setSelectedGame(game)
    setGameForm({
      min_cpu_name: '', min_gpu_name: '',
      min_cpu: game.min_cpu || '', min_ram: game.min_ram || '',
      min_vram: game.min_vram || '', min_disk: game.min_disk || '',
      rec_cpu_name: '', rec_gpu_name: '',
      rec_cpu: game.rec_cpu || '', rec_ram: game.rec_ram || '',
      rec_vram: game.rec_vram || '', rec_disk: game.rec_disk || ''
    })
  }

  const applyPreset = (preset) => {
    switch (preset) {
      case 'retro':
        setGameForm({
          min_cpu_name: 'Intel Core 2 Duo E8400 / AMD Athlon 64',
          min_gpu_name: 'Intel HD Graphics 3000 / NVIDIA GeForce 8600',
          min_cpu: 1200, min_ram: 2, min_vram: 0.5, min_disk: 2,
          rec_cpu_name: 'Intel Core i3-3220 / AMD FX-4100',
          rec_gpu_name: 'Intel HD Graphics 4000 / NVIDIA GeForce GT 630',
          rec_cpu: 1800, rec_ram: 4, rec_vram: 1, rec_disk: 2
        })
        break
      case 'light':
        setGameForm({
          min_cpu_name: 'Intel Core i3-4130 / AMD FX-4300',
          min_gpu_name: 'NVIDIA GeForce GT 1030 (2GB) / AMD Radeon RX 550',
          min_cpu: 1800, min_ram: 4, min_vram: 1, min_disk: 15,
          rec_cpu_name: 'Intel Core i5-6400 / AMD Ryzen 3 1200',
          rec_gpu_name: 'NVIDIA GeForce GTX 750 Ti (2GB) / GTX 1050',
          rec_cpu: 2500, rec_ram: 8, rec_vram: 2, rec_disk: 15
        })
        break
      case 'medium':
        setGameForm({
          min_cpu_name: 'Intel Core i5-4460 / AMD FX-6300',
          min_gpu_name: 'NVIDIA GeForce GTX 960 (2GB) / AMD Radeon RX 570',
          min_cpu: 2800, min_ram: 8, min_vram: 2, min_disk: 35,
          rec_cpu_name: 'Intel Core i5-8400 / AMD Ryzen 5 2600',
          rec_gpu_name: 'NVIDIA GeForce GTX 1060 (6GB) / AMD Radeon RX 580',
          rec_cpu: 3600, rec_ram: 16, rec_vram: 6, rec_disk: 35
        })
        break
      case 'heavy':
        setGameForm({
          min_cpu_name: 'Intel Core i5-10400 / AMD Ryzen 5 3600',
          min_gpu_name: 'NVIDIA GeForce GTX 1070 (8GB) / AMD Radeon RX 5600 XT',
          min_cpu: 3800, min_ram: 12, min_vram: 8, min_disk: 70,
          rec_cpu_name: 'Intel Core i7-10700K / AMD Ryzen 7 5700X',
          rec_gpu_name: 'NVIDIA GeForce RTX 3070 (8GB) / AMD Radeon RX 6700 XT',
          rec_cpu: 4400, rec_ram: 16, rec_vram: 8, rec_disk: 70
        })
        break
      case 'ultra':
        setGameForm({
          min_cpu_name: 'Intel Core i7-12700 / AMD Ryzen 7 7700X',
          min_gpu_name: 'NVIDIA GeForce RTX 2060 (6GB) / AMD Radeon RX 6600',
          min_cpu: 4200, min_ram: 16, min_vram: 8, min_disk: 100,
          rec_cpu_name: 'Intel Core i7-13700K / AMD Ryzen 7 7800X3D',
          rec_gpu_name: 'NVIDIA GeForce RTX 4080 (16GB) / AMD Radeon RX 7900 XT',
          rec_cpu: 5000, rec_ram: 32, rec_vram: 16, rec_disk: 100
        })
        break
      case 'sim':
        setGameForm({
          min_cpu_name: 'Intel Core i5-7400 / AMD Ryzen 3 3100',
          min_gpu_name: 'NVIDIA GeForce GTX 1050 Ti (4GB) / AMD Radeon RX 470',
          min_cpu: 3000, min_ram: 8, min_vram: 4, min_disk: 40,
          rec_cpu_name: 'Intel Core i7-11700 / AMD Ryzen 7 3700X',
          rec_gpu_name: 'NVIDIA GeForce RTX 3060 (12GB) / AMD Radeon RX 6700',
          rec_cpu: 4200, rec_ram: 32, rec_vram: 12, rec_disk: 40
        })
        break
      default:
        break
    }
  }

  const resolveHardware = async (type) => {
    const isMin = type === 'min'
    const cpuName = isMin ? gameForm.min_cpu_name : gameForm.rec_cpu_name
    const gpuName = isMin ? gameForm.min_gpu_name : gameForm.rec_gpu_name
    if (!cpuName && !gpuName) return

    try {
      const res = await fetch(`${API}/api/hardware/resolve-spec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpu_name: cpuName, gpu_name: gpuName })
      })
      const data = await res.json()
      if (res.ok) {
        setGameForm(f => ({
          ...f,
          [isMin ? 'min_cpu' : 'rec_cpu']: data.cpu_score || f[isMin ? 'min_cpu' : 'rec_cpu'],
          [isMin ? 'min_vram' : 'rec_vram']: data.vram || f[isMin ? 'min_vram' : 'rec_vram']
        }))
      }
    } catch (err) { console.error(err) }
  }

  const handleSaveGameSpec = async (e) => {
    e.preventDefault()
    if (!selectedGame) return
    setSavingGame(true)
    try {
      const payload = {
        min_cpu_name: gameForm.min_cpu_name,
        min_gpu_name: gameForm.min_gpu_name,
        rec_cpu_name: gameForm.rec_cpu_name,
        rec_gpu_name: gameForm.rec_gpu_name,
        min_cpu: Number(gameForm.min_cpu) || 0,
        min_ram: Number(gameForm.min_ram) || 0,
        min_vram: Number(gameForm.min_vram) || 0,
        min_disk: Number(gameForm.min_disk) || 0,
        rec_cpu: Number(gameForm.rec_cpu) || 0,
        rec_ram: Number(gameForm.rec_ram) || 0,
        rec_vram: Number(gameForm.rec_vram) || 0,
        rec_disk: Number(gameForm.rec_disk) || 0,
      }
      const res = await fetch(`${API}/api/admin/games/${selectedGame.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      // Update local game list
      setGames(games.map(g => g.id === selectedGame.id ? { ...g, ...payload } : g))
      setSelectedGame(null)
    } catch (err) { alert(err.message) }
    finally { setSavingGame(false) }
  }

  // 🧹 Kosongkan / Reset Spesifikasi Game Ke 0
  const handleResetGameSpec = async (targetGame = selectedGame) => {
    if (!targetGame) return
    if (!window.confirm(`Yakin ingin mengosongkan semua spesifikasi game "${targetGame.name}"? Semua parameter spec akan di-reset menjadi 0.`)) return

    setSavingGame(true)
    try {
      const payload = {
        min_cpu: 0, min_ram: 0, min_vram: 0, min_disk: 0,
        rec_cpu: 0, rec_ram: 0, rec_vram: 0, rec_disk: 0,
        min_cpu_name: '', min_gpu_name: '', rec_cpu_name: '', rec_gpu_name: ''
      }
      const res = await fetch(`${API}/api/admin/games/${targetGame.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setGames(games.map(g => g.id === targetGame.id ? { ...g, ...payload } : g))
      if (selectedGame && selectedGame.id === targetGame.id) {
        setSelectedGame(null)
      }
    } catch (err) { alert(err.message) }
    finally { setSavingGame(false) }
  }

  const handleDoneRequest = async (type, gameName) => {
    if (!window.confirm(`Tandai "${gameName}" sebagai sudah ditambahkan?`)) return
    try {
      const res = await fetch(`${API}/api/admin/requests/${type}/${encodeURIComponent(gameName)}`, {
        method: 'DELETE', headers
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (type === 'new_game') setNewGameReqs(prev => prev.filter(r => r.game_name !== gameName))
      else setDataReqs(prev => prev.filter(r => r.game_name !== gameName))
    } catch (err) { alert(err.message) }
  }

  if (!user || user.role !== 'admin') return null

  // ── Styles ────────────────────────────────────────────────────────────────
  const tabStyle = (t, color = 'var(--accent)') => ({
    fontFamily: 'var(--font-secondary)',
    padding: '12px 22px', background: activeTab === t ? `rgba(0,212,255,0.08)` : 'transparent',
    border: 'none', borderBottom: `2px solid ${activeTab === t ? color : 'transparent'}`,
    color: activeTab === t ? color : 'var(--text2)', fontWeight: 600, fontSize: '0.95rem',
    cursor: 'pointer', transition: 'all 0.2s',
  })
  const tdStyle = { padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.88rem' }
  const thStyle = { padding: '11px 12px', color: 'var(--text3)', fontSize: '0.75rem', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }
  const inputStyle = {
    background: 'var(--bg3)', border: '1px solid var(--border)', color: '#fff',
    borderRadius: 6, padding: '8px 12px', fontSize: '0.85rem', width: '100%', outline: 'none'
  }
  const badge = (color, bg, border) => ({
    padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
    background: bg, color, border: `1px solid ${border}`
  })

  return (
    <main style={{ maxWidth: 1150, margin: '0 auto', padding: '3rem 2rem', animation: 'fadeUp 0.5s ease' }}>
      {/* Autocomplete Data Lists */}
      <datalist id="cpu-list">
        {cpuOptions.map((c, i) => <option key={i} value={c} />)}
      </datalist>
      <datalist id="gpu-list">
        {gpuOptions.map((g, i) => <option key={i} value={g} />)}
      </datalist>

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 2.6rem)', letterSpacing: '0.02em', marginBottom: 6 }}>
          Dashboard <span style={{ color: 'var(--accent)' }}>Admin</span>
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, color: 'var(--text2)', fontSize: '0.9rem' }}>
          Kelola, edit, atau kosongkan spesifikasi game, pantau user, dan tinjau request yang masuk.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <button style={tabStyle('games')} onClick={() => setActiveTab('games')}>
          🎮 Kelola Spesifikasi Game ({loading && activeTab === 'games' ? '…' : games.length})
        </button>
        <button style={tabStyle('users')} onClick={() => setActiveTab('users')}>
          👤 Data User ({loading && activeTab === 'users' ? '…' : users.length})
        </button>
        <button style={tabStyle('requests', '#10b981')} onClick={() => setActiveTab('requests')}>
          📋 Request User ({loading && activeTab === 'requests' ? '…' : newGameReqs.length + dataReqs.length})
        </button>
      </div>

      {/* ── BAR PENCARIAN & FILTER ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <input
            type="text"
            placeholder={
              activeTab === 'games' ? "🔍 Cari nama game untuk edit spesifikasi..." :
              activeTab === 'users' ? "🔍 Cari username atau email user..." :
              "🔍 Cari game yang direquest..."
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              ...inputStyle, paddingLeft: 38, background: 'var(--bg3)',
              borderColor: searchQuery ? 'var(--accent)' : 'var(--border)'
            }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.9rem' }}>
            🔍
          </span>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>

        {/* Filter options per tab */}
        {activeTab === 'games' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>Filter Game:</span>
            <select
              value={gameFilter}
              onChange={e => setGameFilter(e.target.value)}
              style={{
                background: 'var(--bg3)', color: '#fff', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px', fontSize: '0.82rem', outline: 'none', cursor: 'pointer'
              }}>
              <option value="all">Semua Game di Database ({games.length})</option>
              <option value="incomplete">⚠️ Hanya Game Belum Lengkap</option>
              <option value="complete">✅ Hanya Game Sudah Lengkap</option>
              <option value="empty_all">❌ Kosong Total (Min Spec = 0)</option>
              <option value="missing_min">📉 Min Spec Belum Lengkap</option>
              <option value="missing_rec">🚀 Rec Spec Belum Lengkap</option>
              <option value="no_cover">🖼️ Tanpa Cover Image</option>
            </select>
          </div>
        )}

        {activeTab === 'users' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>Role:</span>
            <select
              value={userRoleFilter}
              onChange={e => setUserRoleFilter(e.target.value)}
              style={{
                background: 'var(--bg3)', color: '#fff', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px', fontSize: '0.82rem', outline: 'none', cursor: 'pointer'
              }}>
              <option value="all">Semua User ({users.length})</option>
              <option value="admin">Admin Only</option>
              <option value="user">Regular User</option>
            </select>
          </div>
        )}

        {activeTab === 'requests' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>Tipe Request:</span>
            <select
              value={reqFilter}
              onChange={e => setReqFilter(e.target.value)}
              style={{
                background: 'var(--bg3)', color: '#fff', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px', fontSize: '0.82rem', outline: 'none', cursor: 'pointer'
              }}>
              <option value="all">Semua Request ({newGameReqs.length + dataReqs.length})</option>
              <option value="new_game">🎮 Game Baru ({newGameReqs.length})</option>
              <option value="data">📊 Kelengkapan Data ({dataReqs.length})</option>
            </select>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 16px', color: '#f87171', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
          Error: {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>Memuat data…</div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', overflowX: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>

          {/* Stat Count Summary */}
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              Menampilkan {activeTab === 'games' ? paginatedGames.length : activeTab === 'users' ? paginatedUsers.length : paginatedRequests.length} dari total {
                activeTab === 'games' ? filteredGames.length :
                activeTab === 'users' ? filteredUsers.length :
                filteredRequests.length
              } data
            </span>
            <span>Halaman {page} dari {totalPages}</span>
          </div>

          {/* ── TAB: GAMES ──────────────────────────────────────────── */}
          {activeTab === 'games' && (
            paginatedGames.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>Tidak ada data game yang cocok dengan pencarian / filter ini.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>Cover</th>
                    <th style={thStyle}>Nama Game</th>
                    <th style={thStyle}>Status Kelengkapan Spec</th>
                    <th style={thStyle}>Sumber</th>
                    <th style={thStyle}>Aksi Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedGames.map(g => {
                    const isMinEmpty = !g.min_cpu && !g.min_ram && !g.min_vram && !g.min_disk
                    const isRecEmpty = !g.rec_cpu && !g.rec_ram && !g.rec_vram && !g.rec_disk
                    const isFullyComplete = !isMinEmpty && !isRecEmpty
                    return (
                      <tr key={g.id}>
                        <td style={{ ...tdStyle, width: 52 }}>
                          {g.cover_image_url
                            ? <img src={`${API}/api/image-proxy?url=${encodeURIComponent(g.cover_image_url)}`} alt={g.name} style={{ width: 40, height: 54, objectFit: 'cover', borderRadius: 6 }} onError={e => e.target.style.display = 'none'} />
                            : <span style={{ fontSize: '0.68rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '2px 4px', borderRadius: 4 }}>No Cover</span>}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent2)', minWidth: 200 }}>{g.name}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {isFullyComplete ? (
                              <span style={badge('#10b981', 'rgba(16,185,129,0.12)', 'rgba(16,185,129,0.3)')}>✓ Spec Lengkap</span>
                            ) : (
                              <>
                                {isMinEmpty ? (
                                  <span style={badge('#ef4444', 'rgba(239,68,68,0.12)', 'rgba(239,68,68,0.3)')}>Min Spec Kosong ❌</span>
                                ) : (
                                  <span style={badge('#38bdf8', 'rgba(56,189,248,0.12)', 'rgba(56,189,248,0.3)')}>Min Spec Ada ✓</span>
                                )}

                                {isRecEmpty ? (
                                  <span style={badge('#fbbf24', 'rgba(251,191,36,0.12)', 'rgba(251,191,36,0.3)')}>Rec Spec Kosong ⚠️</span>
                                ) : (
                                  <span style={badge('#4ade80', 'rgba(74,222,128,0.12)', 'rgba(74,222,128,0.3)')}>Rec Spec Ada ✓</span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {g.url
                            ? <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.8rem' }}>PCGamingWiki ↗</a>
                            : <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>-</span>}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => openSpecModal(g)}
                              style={btn({ background: 'linear-gradient(135deg, var(--accent), #06b6d4)', color: '#000', fontWeight: 700, padding: '6px 14px' })}>
                              ✏️ Edit Spec
                            </button>
                            {!isMinEmpty && (
                              <button
                                onClick={() => handleResetGameSpec(g)}
                                title="Kosongkan spesifikasi game ini (set ke 0)"
                                style={btn({ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', padding: '6px 10px' })}>
                                🧹 Kosongkan
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}

          {/* ── TAB: USERS ──────────────────────────────────────────── */}
          {activeTab === 'users' && (
            paginatedUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>Tidak ada user yang cocok dengan pencarian.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Username</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Provider</th>
                    <th style={thStyle}>Daftar</th>
                    <th style={thStyle}>Spesifikasi</th>
                    <th style={thStyle}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(u => {
                    const role = u.role || 'user'
                    const provider = u.auth_provider || 'local'
                    return (
                      <tr key={u.id}>
                        <td style={{ ...tdStyle, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>#{u.id}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent2)' }}>{u.username}</td>
                        <td style={tdStyle}>
                          {editingUserId === u.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <input type="email" value={editingEmail} onChange={e => setEditingEmail(e.target.value)}
                                placeholder="email@example.com" style={{ ...inputStyle, width: 155, padding: '4px 8px' }} />
                              <button onClick={() => handleSaveEmail(u.id)} disabled={savingEmail}
                                style={btn({ background: 'var(--accent)', color: '#000', padding: '4px 8px' })}>
                                {savingEmail ? '...' : 'Simpan'}
                              </button>
                              <button onClick={() => setEditingUserId(null)}
                                style={btn({ background: 'transparent', color: 'var(--text3)' })}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                              <span style={{ fontSize: '0.85rem' }}>{u.email && u.email !== '-' ? u.email : '-'}</span>
                              <button onClick={() => { setEditingUserId(u.id); setEditingEmail(u.email !== '-' ? u.email || '' : '') }}
                                style={btn({ background: 'rgba(255,255,255,0.05)', color: 'var(--text2)', border: '1px solid var(--border)', padding: '3px 8px' })}>
                                ✏️ {u.email && u.email !== '-' ? 'Edit' : '+ Tambah'}
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={badge(role === 'admin' ? '#ef4444' : '#3b82f6', role === 'admin' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)', role === 'admin' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)')}>
                            {role}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={badge(provider === 'google' ? '#f43f5e' : '#9ca3af', provider === 'google' ? 'rgba(244,63,94,0.12)' : 'rgba(107,114,128,0.12)', provider === 'google' ? 'rgba(244,63,94,0.3)' : 'rgba(107,114,128,0.3)')}>
                            {provider}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text2)' }}>{u.created_at || '-'}</td>
                        <td style={tdStyle}>
                          {u.spec ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {[`CPU: ${u.spec.cpuName}`, `RAM: ${u.spec.ram}GB`, `GPU: ${u.spec.gpuName}`, `Disk: ${u.spec.disk}GB`, `OS: ${u.spec.os}`].map(t => (
                                <span key={t} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontSize: '0.72rem' }}>{t}</span>
                              ))}
                            </div>
                          ) : <span style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: '0.8rem' }}>Belum cek spesifikasi</span>}
                        </td>
                        <td style={tdStyle}>
                          {role !== 'admin' && (
                            <button onClick={() => handleDeleteUser(u.id, u.username)}
                              style={btn({ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', padding: '4px 10px' })}>
                              🗑 Hapus
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}

          {/* ── TAB: REQUESTS ───────────────────────────────────────── */}
          {activeTab === 'requests' && (
            paginatedRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>Tidak ada request yang cocok dengan pencarian.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>Nama Game</th>
                    <th style={thStyle}>Tipe</th>
                    <th style={thStyle}>Total Request</th>
                    <th style={thStyle}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRequests.map((r, i) => (
                    <tr key={`${r.type}-${i}`}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{r.game_name}</td>
                      <td style={tdStyle}>
                        {r.type === 'new_game' ? (
                          <span style={badge('#10b981', 'rgba(16,185,129,0.12)', 'rgba(16,185,129,0.3)')}>Game Baru</span>
                        ) : (
                          <span style={badge('var(--accent)', 'rgba(0,212,255,0.1)', 'rgba(0,212,255,0.3)')}>Data Lengkap</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: r.type === 'new_game' ? '#10b981' : 'var(--accent)', fontWeight: 700 }}>{r.request_count || 1}x</td>
                      <td style={tdStyle}>
                        <button onClick={() => handleDoneRequest(r.type, r.game_name)}
                          style={btn({ background: r.type === 'new_game' ? 'rgba(16,185,129,0.1)' : 'rgba(0,212,255,0.1)', color: r.type === 'new_game' ? '#10b981' : 'var(--accent)', border: `1px solid ${r.type === 'new_game' ? 'rgba(16,185,129,0.3)' : 'rgba(0,212,255,0.3)'}`, padding: '4px 12px' })}>
                          ✅ Sudah {r.type === 'new_game' ? 'Ditambahkan' : 'Dilengkapi'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* ── PAGINATION CONTROLS ───────────────────────────────────── */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={btn({ background: page <= 1 ? 'rgba(255,255,255,0.02)' : 'var(--bg3)', color: page <= 1 ? 'var(--text3)' : '#fff', border: '1px solid var(--border)' })}>
                « Sebelumnya
              </button>
              <span style={{ fontSize: '0.82rem', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                Halaman {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={btn({ background: page >= totalPages ? 'rgba(255,255,255,0.02)' : 'var(--bg3)', color: page >= totalPages ? 'var(--text3)' : '#fff', border: '1px solid var(--border)' })}>
                Selanjutnya »
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── MODAL INPUT SPESIFIKASI GAME LENGKAP ───────────────────────────────────── */}
      {selectedGame && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 16, width: '100%', maxWidth: 840, padding: '2rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'fadeUp 0.3s ease',
            maxHeight: '92vh', overflowY: 'auto'
          }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--accent2)' }}>
                  Edit Spesifikasi Game
                </h2>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: 4 }}>
                  {selectedGame.name}
                </div>
              </div>
              <button onClick={() => setSelectedGame(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: '1.4rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {/* Quick Presets dengan Model CPU & GPU Lengkap */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚡ Preset Model Hardware Lengkap (Sekali Klik Isi Otomatis)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
                
                <button type="button" onClick={() => applyPreset('retro')} style={btn({ background: 'rgba(148,163,184,0.12)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)', textAlign: 'left', padding: '8px 12px' })}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>🕹️ 1. Retro / 2D / Pixel</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>Stardew, Terraria, Undertale</div>
                </button>

                <button type="button" onClick={() => applyPreset('light')} style={btn({ background: 'rgba(16,185,129,0.12)', color: '#4ade80', border: '1px solid rgba(16,185,129,0.3)', textAlign: 'left', padding: '8px 12px' })}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>🎮 2. Esports / Ringan</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>Valorant, Dota 2, CS:GO</div>
                </button>

                <button type="button" onClick={() => applyPreset('medium')} style={btn({ background: 'rgba(0,212,255,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,212,255,0.3)', textAlign: 'left', padding: '8px 12px' })}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>⚔️ 3. Menengah (Standard 3D)</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>GTA V, Genshin, Witcher 3</div>
                </button>

                <button type="button" onClick={() => applyPreset('heavy')} style={btn({ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)', textAlign: 'left', padding: '8px 12px' })}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>🔥 4. Game AAA Modern</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>Cyberpunk, RDR2, Elden Ring</div>
                </button>

                <button type="button" onClick={() => applyPreset('ultra')} style={btn({ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', textAlign: 'left', padding: '8px 12px' })}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>🚀 5. Next-Gen / Ultra AAA</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>Alan Wake 2, Wukong</div>
                </button>

                <button type="button" onClick={() => applyPreset('sim')} style={btn({ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', textAlign: 'left', padding: '8px 12px' })}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>🏎️ 6. Simulasi & Strategi</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>Cities Skylines II, Flight Sim</div>
                </button>

              </div>
            </div>

            {/* Form Inputs */}
            <form onSubmit={handleSaveGameSpec}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                
                {/* Columns Minimum */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8', margin: 0 }}>
                      📉 Spesifikasi Minimum
                    </h3>
                    <button type="button" onClick={() => resolveHardware('min')} style={btn({ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '3px 8px', fontSize: '0.7rem' })}>
                      ⚡ Hitung dari Model
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Model CPU */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                        Tipe / Model CPU Minimum
                      </label>
                      <input
                        type="text" list="cpu-list"
                        placeholder="Contoh: Intel Core i3-4130 / AMD FX-6300"
                        value={gameForm.min_cpu_name}
                        onChange={e => setGameForm(f => ({ ...f, min_cpu_name: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>

                    {/* Model GPU */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                        Tipe / Model GPU Minimum
                      </label>
                      <input
                        type="text" list="gpu-list"
                        placeholder="Contoh: NVIDIA GeForce GTX 750 Ti / AMD RX 460"
                        value={gameForm.min_gpu_name}
                        onChange={e => setGameForm(f => ({ ...f, min_gpu_name: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                          CPU Score (MHz)
                        </label>
                        <input type="number" min="0" placeholder="1800" value={gameForm.min_cpu} onChange={e => setGameForm(f => ({ ...f, min_cpu: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                          RAM (GB)
                        </label>
                        <input type="number" min="0" step="0.5" placeholder="8" value={gameForm.min_ram} onChange={e => setGameForm(f => ({ ...f, min_ram: e.target.value }))} style={inputStyle} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                          VRAM (GB)
                        </label>
                        <input type="number" min="0" step="0.5" placeholder="2" value={gameForm.min_vram} onChange={e => setGameForm(f => ({ ...f, min_vram: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                          Disk Storage (GB)
                        </label>
                        <input type="number" min="0" placeholder="30" value={gameForm.min_disk} onChange={e => setGameForm(f => ({ ...f, min_disk: e.target.value }))} style={inputStyle} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Columns Recommended */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#4ade80', margin: 0 }}>
                      🚀 Spesifikasi Rekomendasi
                    </h3>
                    <button type="button" onClick={() => resolveHardware('rec')} style={btn({ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', padding: '3px 8px', fontSize: '0.7rem' })}>
                      ⚡ Hitung dari Model
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Model CPU */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                        Tipe / Model CPU Rekomendasi
                      </label>
                      <input
                        type="text" list="cpu-list"
                        placeholder="Contoh: Intel Core i5-8400 / AMD Ryzen 5 2600"
                        value={gameForm.rec_cpu_name}
                        onChange={e => setGameForm(f => ({ ...f, rec_cpu_name: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>

                    {/* Model GPU */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                        Tipe / Model GPU Rekomendasi
                      </label>
                      <input
                        type="text" list="gpu-list"
                        placeholder="Contoh: NVIDIA GeForce GTX 1060 / AMD RX 580"
                        value={gameForm.rec_gpu_name}
                        onChange={e => setGameForm(f => ({ ...f, rec_gpu_name: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                          CPU Score (MHz)
                        </label>
                        <input type="number" min="0" placeholder="3600" value={gameForm.rec_cpu} onChange={e => setGameForm(f => ({ ...f, rec_cpu: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                          RAM (GB)
                        </label>
                        <input type="number" min="0" step="0.5" placeholder="16" value={gameForm.rec_ram} onChange={e => setGameForm(f => ({ ...f, rec_ram: e.target.value }))} style={inputStyle} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                          VRAM (GB)
                        </label>
                        <input type="number" min="0" step="0.5" placeholder="6" value={gameForm.rec_vram} onChange={e => setGameForm(f => ({ ...f, rec_vram: e.target.value }))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                          Disk Storage (GB)
                        </label>
                        <input type="number" min="0" placeholder="30" value={gameForm.rec_disk} onChange={e => setGameForm(f => ({ ...f, rec_disk: e.target.value }))} style={inputStyle} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Info Panduan */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                💡 <strong>Tips Admin:</strong> Anda dapat mengedit spesifikasi game atau menekan tombol <strong>"🧹 Kosongkan Spec (Reset ke 0)"</strong> untuk menghapus data spesifikasi game yang salah.
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleResetGameSpec(selectedGame)}
                  disabled={savingGame}
                  style={btn({ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', padding: '10px 16px', fontSize: '0.82rem' })}>
                  🧹 Kosongkan Spec (Reset ke 0)
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setSelectedGame(null)} style={btn({ background: 'rgba(255,255,255,0.08)', color: 'var(--text2)', padding: '10px 20px', fontSize: '0.88rem' })}>
                    Batal
                  </button>
                  <button type="submit" disabled={savingGame} style={btn({ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#000', fontWeight: 800, padding: '10px 24px', fontSize: '0.88rem' })}>
                    {savingGame ? 'Menyimpan...' : '✓ Simpan Spesifikasi Game'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
