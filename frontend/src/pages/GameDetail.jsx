import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { normalizeSpec } from "../utils/analyzer";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const proxyImageUrl = (url) => {
  if (!url) return null;
  return `${API}/api/image-proxy?url=${encodeURIComponent(url)}`;
};

const GRADE_INFO = {
  "?": { emoji: "❓", label: "Data Belum Tersedia", color: "#94a3b8", desc: "Sistem belum memiliki data spesifikasi untuk game ini. Silakan cek ulang nanti." },
  S: { emoji: "🏆", label: "Sangat Optimal", color: "#e5b842", desc: "PC kamu jauh melampaui kebutuhan game ini. Pengalaman bermain akan sangat mulus." },
  A: { emoji: "✅", label: "Direkomendasikan", color: "#10b981", desc: "PC kamu memenuhi spesifikasi rekomendasi. Pengalaman bermain akan optimal." },
  B: { emoji: "⚠️", label: "Bisa (Minimum)", color: "#f59e0b", desc: "PC kamu hanya memenuhi spesifikasi minimum. Mungkin perlu setting grafis rendah." },
  C: { emoji: "⚡", label: "Di Bawah Minimum", color: "#f97316", desc: "Beberapa komponen PC kamu berada di bawah minimum. Game mungkin tidak berjalan mulus." },
  D: { emoji: "❌", label: "Tidak Bisa Dijalankan", color: "#ef4444", desc: "PC kamu tidak memenuhi spesifikasi minimum game ini." },
};

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
];

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
];

function Bar({ pct, color }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: color,
          borderRadius: 3,
          transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}

function StatItem({ label, value, icon }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "var(--bg3)",
        borderRadius: 10,
        padding: "12px 16px",
      }}
    >
      <span style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {icon} {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

export default function GameDetail() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Manual Form State
  const [form, setForm] = useState({
    cpuIdx: "",
    gpuIdx: "",
    ram: "",
    disk: "",
  });

  // Determine if we have specs in query parameters OR localStorage
  const getActiveSpec = () => {
    const qCpu = searchParams.get("cpu");
    const qRam = searchParams.get("ram");
    if (qCpu && qRam) {
      return {
        cpu: Number(qCpu),
        ram: Number(qRam),
        vram: Number(searchParams.get("vram") || 0),
        disk: Number(searchParams.get("disk") || 0),
        cpuName: searchParams.get("cpuName") || "Unknown CPU",
        gpuName: searchParams.get("gpuName") || "Unknown GPU",
        os: searchParams.get("os") || "Windows",
      };
    }
    const localSpec = localStorage.getItem("user_spec");
    if (localSpec) {
      try {
        return JSON.parse(localSpec);
      } catch (err) {
        return null;
      }
    }
    return null;
  };

  const activeSpec = getActiveSpec();
  const specAvailable = !!activeSpec;

  useEffect(() => {
    const loadGame = async () => {
      try {
        if (specAvailable) {
          // Mode A: Comparison Mode
          const normalized = normalizeSpec(activeSpec);
          const res = await fetch(`${API}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(normalized),
          });
          if (!res.ok) throw new Error("API error");
          const data = await res.json();
          // Find game by ID in the list
          const found = data.results.find((r) => String(r.id) === String(gameId));
          if (found) {
            setGame(found);
          } else {
            // Fallback to raw detail if not found in results
            const rawRes = await fetch(`${API}/api/software/${gameId}`);
            if (rawRes.ok) {
              const rawGame = await rawRes.json();
              setGame(rawGame);
            }
          }
        } else {
          // Mode B: Info Mode (Fetch game details directly)
          const res = await fetch(`${API}/api/software/${gameId}`);
          if (!res.ok) throw new Error("Game not found");
          const data = await res.json();
          setGame(data);
        }
      } catch (err) {
        console.error("Gagal memuat data game", err);
        setGame(null);
      } finally {
        setLoading(false);
      }
    };
    loadGame();
  }, [gameId, specAvailable]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API}/api/download-detector`);
      if (!res.ok) throw new Error("not available");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "BisaMainNggakYa_Detect.exe";
      a.click();
    } catch {
      alert("File detector belum tersedia. Silakan gunakan form Input Manual.");
    } finally {
      setDownloading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const { cpuIdx, gpuIdx, ram, disk } = form;
    if (cpuIdx === "" || gpuIdx === "" || !ram || !disk) {
      alert("Mohon lengkapi semua spesifikasi PC Anda!");
      return;
    }

    const selectedCpu = cpuOptions[Number(cpuIdx)];
    const selectedGpu = gpuOptions[Number(gpuIdx)];

    const cpuVal = selectedCpu.value;
    const ramVal = Number(ram);
    const vramVal = selectedGpu.value;
    const diskVal = Number(disk);
    const cpuNameVal = selectedCpu.name;
    const gpuNameVal = selectedGpu.name;

    // Save spec
    const newSpec = {
      cpu: cpuVal,
      ram: ramVal,
      vram: vramVal,
      disk: diskVal,
      cpuName: cpuNameVal,
      gpuName: gpuNameVal,
      os: "Windows",
    };
    localStorage.setItem("user_spec", JSON.stringify(newSpec));

    // Redirect to same page with the params to show comparison
    const p = new URLSearchParams({
      cpu: String(cpuVal),
      ram: String(ramVal),
      vram: String(vramVal),
      disk: String(diskVal),
      cpuName: cpuNameVal,
      gpuName: gpuNameVal,
    });
    navigate(`/game/${gameId}?${p}`);
  };

  const renderSpecValue = (label, val, raw, type) => {
    if (type === "user") {
      if (label === "CPU") return `${val} MHz`;
      if (label === "RAM") return `${val} GB`;
      if (label === "GPU") return `${val} GB VRAM`;
      if (label === "Storage") return `${val} GB`;
      return val;
    }
    if (raw) {
      if (label === "CPU") {
        const r = type === "min" ? raw.cpu_min : raw.cpu_rec;
        if (r && r !== "N/A") return r;
      }
      if (label === "GPU") {
        const r = type === "min" ? raw.gpu_min : raw.gpu_rec;
        if (r && r !== "N/A") return r;
      }
    }
    if (val === 0) return "N/A";
    if (label === "CPU") return `${val} MHz`;
    if (label === "RAM") return `${val} GB`;
    if (label === "GPU") return `${val} GB VRAM`;
    if (label === "Storage") return `${val} GB`;
    return val;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70vh", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 48, height: 48, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>Memuat data game...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!game) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "var(--text3)" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎮</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", marginBottom: 20 }}>Game tidak ditemukan.</div>
        <button
          onClick={() => navigate("/")}
          style={{ padding: "10px 24px", borderRadius: 8, background: "var(--accent)", color: "#000", fontWeight: 700, border: "none", cursor: "pointer" }}
        >
          ← Kembali ke Beranda
        </button>
      </div>
    );
  }

  // Determine colors based on Mode
  const isComparisonMode = specAvailable && game.result;
  const gameColor = isComparisonMode ? game.result.color : "var(--accent2)";
  const g = isComparisonMode
    ? (GRADE_INFO[game.result.grade] || GRADE_INFO["?"])
    : { emoji: "🎮", label: "Detail Game", color: "var(--accent2)", desc: "Lihat persyaratan sistem resmi untuk game ini di bawah. Masukkan spesifikasi PC Anda untuk membandingkan kecocokan." };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem", animation: "fadeUp 0.4s ease" }}>
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 16px",
          borderRadius: 8,
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          color: "var(--text2)",
          fontWeight: 600,
          fontSize: "0.82rem",
          marginBottom: "1.5rem",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
      >
        ← Kembali
      </button>

      {/* Hero Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "1.5rem",
          alignItems: "flex-start",
          background: "var(--bg2)",
          border: `1px solid ${gameColor}33`,
          borderRadius: 16,
          padding: "1.5rem",
          marginBottom: "1.5rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse 60% 80% at 0% 50%, ${gameColor}0a 0%, transparent 70%)`,
        }} />

        {/* Cover Image */}
        {game.cover_image_url && !imgError ? (
          <img
            src={proxyImageUrl(game.cover_image_url)}
            alt={game.name}
            onError={() => setImgError(true)}
            style={{
              width: 100,
              height: 140,
              objectFit: "cover",
              borderRadius: 10,
              border: `2px solid ${gameColor}44`,
              flexShrink: 0,
              boxShadow: `0 8px 24px ${gameColor}20`,
            }}
          />
        ) : (
          <div style={{
            width: 100, height: 140, borderRadius: 10,
            background: "var(--bg3)", border: "2px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "3rem",
          }}>
            🎮
          </div>
        )}

        {/* Info */}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            🎮 Game
          </div>
          <h1 style={{ fontWeight: 800, fontSize: "clamp(1.3rem, 3vw, 1.8rem)", lineHeight: 1.2, marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>
            {game.name}
          </h1>

          {/* Grade / Info Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: gameColor + "18",
            border: `1px solid ${gameColor}44`,
            borderRadius: 100, padding: "6px 16px",
            fontSize: "0.82rem", fontWeight: 700, color: gameColor,
            marginBottom: "0.75rem",
          }}>
            <span style={{ fontSize: "1rem" }}>{g.emoji}</span>
            <span>{isComparisonMode ? `Grade ${game.result.grade} — ${g.label}` : g.label}</span>
            {isComparisonMode && game.result.totalScore >= 0 && (
              <span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>{game.result.totalScore}/100</span>
            )}
          </div>

          <p style={{ color: "var(--text2)", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "0.75rem", maxWidth: 560 }}>
            {game.description || "Tidak ada deskripsi tersedia untuk game ini."}
          </p>

          {/* Overall score bar if in comparison mode */}
          {isComparisonMode && (
            <div style={{ maxWidth: 340 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.72rem", color: "var(--text3)" }}>
                <span>Kompatibilitas</span>
                <span style={{ fontFamily: "var(--font-mono)", color: game.result.color }}>
                  {game.result.totalScore >= 0 ? `${game.result.totalScore}%` : "N/A"}
                </span>
              </div>
              <Bar pct={game.result.totalScore >= 0 ? game.result.totalScore : 0} color={game.result.color} />
            </div>
          )}
        </div>
      </div>

      {/* ── CTA FOR NON-SPEC USERS ── */}
      {!specAvailable && (
        <section style={{
          background: "var(--bg2)",
          border: "1px solid var(--accent)",
          borderRadius: 16,
          padding: "2rem",
          marginBottom: "1.5rem",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Subtle neon outline */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--accent)" }} />

          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.2rem",
            textAlign: "center", marginBottom: "0.5rem", color: "var(--accent)"
          }}>
            ⚡ Cek Spesifikasi PC Kamu Sekarang
          </h2>
          <p style={{ color: "var(--text2)", fontSize: "0.8rem", textAlign: "center", marginBottom: "1.5rem" }}>
            Bandingkan hardware PC Anda secara instan dengan spesifikasi game ini untuk melihat grade performa.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: "2rem",
            alignItems: "start"
          }}>
            {/* Download Card */}
            <div style={{
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "space-between"
            }}>
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.5rem" }}>↓ Deteksi Otomatis</h4>
                <p style={{ fontSize: "0.75rem", color: "var(--text2)", lineHeight: 1.5, marginBottom: "1rem" }}>
                  Unduh detector ringan kami untuk mendeteksi spek PC Anda secara otomatis tanpa input satu per satu.
                </p>
              </div>
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  width: "100%",
                  background: "var(--accent2)",
                  color: "#000",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  padding: "10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  opacity: downloading ? 0.7 : 1,
                }}
              >
                {downloading ? "⏳ Downloading..." : "Download Detector"}
              </button>
            </div>

            {/* Quick manual form */}
            <form onSubmit={handleManualSubmit} style={{
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "1.25rem"
            }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem" }}>✍ Input Cepat</h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text3)", marginBottom: 4 }}>CPU</label>
                  <select
                    required
                    value={form.cpuIdx}
                    onChange={e => setForm(f => ({ ...f, cpuIdx: e.target.value }))}
                    style={{ width: "100%", padding: "6px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: "0.75rem" }}
                  >
                    <option value="">CPU</option>
                    {cpuOptions.map((o, i) => <option key={i} value={i}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text3)", marginBottom: 4 }}>GPU</label>
                  <select
                    required
                    value={form.gpuIdx}
                    onChange={e => setForm(f => ({ ...f, gpuIdx: e.target.value }))}
                    style={{ width: "100%", padding: "6px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: "0.75rem" }}
                  >
                    <option value="">GPU</option>
                    {gpuOptions.map((o, i) => <option key={i} value={i}>{o.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text3)", marginBottom: 4 }}>RAM (GB)</label>
                  <input
                    required
                    type="number"
                    placeholder="RAM"
                    value={form.ram}
                    onChange={e => setForm(f => ({ ...f, ram: e.target.value }))}
                    style={{ width: "100%", padding: "6px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: "0.75rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text3)", marginBottom: 4 }}>Disk (GB)</label>
                  <input
                    required
                    type="number"
                    placeholder="Disk"
                    value={form.disk}
                    onChange={e => setForm(f => ({ ...f, disk: e.target.value }))}
                    style={{ width: "100%", padding: "6px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: "0.75rem" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  background: "var(--accent)",
                  color: "#000",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  padding: "8px",
                  borderRadius: 6,
                  cursor: "pointer"
                }}
              >
                Bandingkan Spek PC →
              </button>
            </form>
          </div>
        </section>
      )}



      {/* Spec Per-Component Cards (Only shown in comparison mode) */}
      {isComparisonMode && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--accent)" }}>⚙</span> Analisis Komponen
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {game.result.details.map((d) => {
              const statusColor = d.status === "optimal" ? "#10b981" : d.status === "minimum" ? "#f59e0b" : d.status === "unknown" ? "#94a3b8" : "#ef4444";
              const statusLabel = d.status === "optimal" ? "✓ Optimal" : d.status === "minimum" ? "~ Minimum" : d.status === "unknown" ? "? Unknown" : "✗ Di Bawah Min";
              const icons = { CPU: "🖥", RAM: "🧠", GPU: "🎴", Storage: "💾" };
              return (
                <div
                  key={d.label}
                  style={{
                    background: "var(--bg2)",
                    border: `1px solid ${statusColor}33`,
                    borderRadius: 12,
                    padding: "1rem",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: statusColor, borderRadius: "12px 12px 0 0" }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text3)" }}>
                      {icons[d.label] || "⚡"} {d.label}
                    </span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: statusColor }}>{statusLabel}</span>
                  </div>
                  <Bar pct={d.pct} color={statusColor} />
                  <div style={{ marginTop: 10, fontSize: "0.78rem", color: "var(--text2)" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                      {renderSpecValue(d.label, d.user, game.raw, "user")}
                    </div>
                    <div style={{ color: "var(--text3)" }}>PC kamu</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spec Requirements Table */}
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: 16, overflow: "hidden", marginBottom: "1.5rem",
      }}>
        <div style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ color: "var(--accent)", fontSize: "1.1rem" }}>📋</span>
          <h2 style={{ fontWeight: 700, fontSize: "1.05rem" }}>Tabel Spesifikasi</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--bg3)" }}>
                <th style={{ padding: "12px 20px", textAlign: "left", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  Komponen
                </th>
                <th style={{ padding: "12px 20px", textAlign: "left", color: "#f59e0b", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  ⚠ Minimum
                </th>
                <th style={{ padding: "12px 20px", textAlign: "left", color: "#10b981", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  ✓ Rekomendasi
                </th>
                {isComparisonMode && (
                  <>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                      💻 PC Kamu
                    </th>
                    <th style={{ padding: "12px 20px", textAlign: "center", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                      Status
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isComparisonMode ? (
                game.result.details.map((d, i) => {
                  const statusColor = d.status === "optimal" ? "#10b981" : d.status === "minimum" ? "#f59e0b" : d.status === "unknown" ? "#94a3b8" : "#ef4444";
                  const statusEmoji = d.status === "optimal" ? "✓" : d.status === "minimum" ? "~" : d.status === "unknown" ? "?" : "✗";
                  const icons = { CPU: "🖥", RAM: "🧠", GPU: "🎴", Storage: "💾" };
                  return (
                    <tr
                      key={d.label}
                      style={{
                        borderTop: i === 0 ? "none" : "1px solid var(--border)",
                        background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      <td style={{ padding: "14px 20px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)" }}>
                        {icons[d.label] || "⚡"} {d.label}
                      </td>
                      <td style={{ padding: "14px 20px", color: "#f59e0b", fontSize: "0.82rem" }}>
                        {renderSpecValue(d.label, d.min, game.raw, "min")}
                      </td>
                      <td style={{ padding: "14px 20px", color: "#10b981", fontSize: "0.82rem" }}>
                        {renderSpecValue(d.label, d.rec, game.raw, "rec")}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: "var(--font-mono)", color: "var(--accent)", fontSize: "0.82rem", fontWeight: 700 }}>
                        {renderSpecValue(d.label, d.user, game.raw, "user")}
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 28, height: 28, borderRadius: "50%",
                          background: statusColor + "20",
                          border: `1px solid ${statusColor}60`,
                          color: statusColor, fontWeight: 700, fontSize: "0.9rem",
                        }}>
                          {statusEmoji}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                // Non-Comparison table (Just 3 columns)
                [
                  { label: "CPU", min: game.min_cpu, rec: game.rec_cpu, icon: "🖥" },
                  { label: "RAM", min: game.min_ram, rec: game.rec_ram, icon: "🧠" },
                  { label: "GPU", min: game.min_vram, rec: game.rec_vram, icon: "🎴" },
                  { label: "Storage", min: game.min_disk, rec: game.rec_disk, icon: "💾" }
                ].map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                      background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "14px 20px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)" }}>
                      {row.icon} {row.label}
                    </td>
                    <td style={{ padding: "14px 20px", color: "#f59e0b", fontSize: "0.82rem" }}>
                      {renderSpecValue(row.label, row.min, game.raw, "min")}
                    </td>
                    <td style={{ padding: "14px 20px", color: "#10b981", fontSize: "0.82rem" }}>
                      {renderSpecValue(row.label, row.rec, game.raw, "rec")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendation Box (Only shown in comparison mode) */}
      {isComparisonMode && (
        <div style={{
          background: `linear-gradient(135deg, ${game.result.color}08 0%, transparent 100%)`,
          border: `1px solid ${game.result.color}33`,
          borderRadius: 14,
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.12em", color: game.result.color, textTransform: "uppercase", marginBottom: 10 }}>
            💡 Rekomendasi
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {game.result.grade === "?" && (
              <>
                <RecommendItem icon="❓" text="Data persyaratan sistem untuk game ini belum tersedia dalam database." />
                <RecommendItem icon="🔍" text="Kami akan terus memperbarui data secara berkala." />
              </>
            )}
            {game.result.grade === "S" && (
              <>
                <RecommendItem icon="🏆" text="PC kamu sangat cocok untuk game ini. Mainkan di setting grafis Ultra / Max!" />
                <RecommendItem icon="📺" text="Coba aktifkan Ray Tracing atau resolusi tinggi (1440p / 4K) untuk pengalaman terbaik." />
                <RecommendItem icon="⚡" text="Frame rate kemungkinan akan sangat tinggi. Pertimbangkan monitor 144Hz atau lebih." />
              </>
            )}
            {game.result.grade === "A" && (
              <>
                <RecommendItem icon="✅" text="PC kamu memenuhi spek rekomendasi. Mainkan di setting High atau Ultra." />
                <RecommendItem icon="🎯" text="Pengalaman bermain akan lancar dan stabil di resolusi 1080p." />
              </>
            )}
            {game.result.grade === "B" && (
              <>
                <RecommendItem icon="⚠️" text="PC kamu hanya memenuhi spek minimum. Gunakan setting grafis Low atau Medium." />
                <RecommendItem icon="🔧" text="Tutup aplikasi background untuk memaksimalkan performa." />
                <RecommendItem icon="📉" text="Pertimbangkan upgrade komponen yang ditandai di bawah minimum." />
              </>
            )}
            {game.result.grade === "C" && (
              <>
                <RecommendItem icon="⚡" text="Beberapa komponen PC kamu berada di bawah minimum yang dibutuhkan." />
                <RecommendItem icon="🔧" text="Game mungkin bisa berjalan dengan lag atau crash. Coba setting paling rendah." />
                <RecommendItem icon="💰" text="Sangat disarankan untuk upgrade komponen sebelum membeli game ini." />
              </>
            )}
            {game.result.grade === "D" && (
              <>
                <RecommendItem icon="❌" text="PC kamu tidak memenuhi spesifikasi minimum game ini." />
                <RecommendItem icon="💰" text="Upgrade hardware diperlukan sebelum bisa menjalankan game ini." />
                <RecommendItem icon="🎮" text="Pertimbangkan bermain di cloud gaming seperti GeForce NOW atau Xbox Cloud Gaming." />
              </>
            )}
          </div>
        </div>
      )}

      {/* Your PC Specs Summary (Only shown in comparison mode) */}
      {isComparisonMode && (
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "2rem",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.12em", color: "var(--text3)", textTransform: "uppercase", marginBottom: 12 }}>
            💻 Spesifikasi PC Kamu
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            <StatItem icon="🖥" label="CPU" value={activeSpec.cpuName} />
            <StatItem icon="🧠" label="RAM" value={`${activeSpec.ram} GB`} />
            <StatItem icon="🎴" label="GPU" value={activeSpec.gpuName} />
            <StatItem icon="💾" label="Storage" value={`${activeSpec.disk} GB`} />
            <StatItem icon="🪟" label="OS" value={activeSpec.os || "Windows"} />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "11px 28px", borderRadius: 10,
            background: "var(--bg2)", border: "1px solid var(--border)",
            color: "var(--text2)", fontWeight: 600, fontSize: "0.9rem",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
        >
          ← Beranda
        </button>
        {isComparisonMode && (
          <button
            onClick={() => {
              localStorage.removeItem("user_spec");
              navigate(`/game/${gameId}`); // Clear params to go back to info mode
            }}
            style={{
              padding: "11px 28px", borderRadius: 10,
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--text3)", fontWeight: 600, fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text2)"; e.currentTarget.style.color = "var(--text2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text3)"; }}
          >
            ✏ Reset Perbandingan
          </button>
        )}
      </div>
    </main>
  );
}

function RecommendItem({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.87rem", color: "var(--text2)", lineHeight: 1.5 }}>
      <span style={{ fontSize: "1rem", flexShrink: 0 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
