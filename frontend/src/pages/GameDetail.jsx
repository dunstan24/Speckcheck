import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { normalizeSpec } from "../utils/analyzer";
import { splitConcatenatedSpecs } from "../utils/hardwareMatcher";

const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname.includes('bisamainnggak.com') ? 'https://api.bisamainnggak.com' : 'http://localhost:5000');

const proxyImageUrl = (url) => {
  if (!url) return null;
  return `${API}/api/image-proxy?url=${encodeURIComponent(url)}`;
};

const GRADE_INFO = {
  "?": { emoji: "", label: "Data Belum Tersedia", color: "#94a3b8", desc: "Sistem belum memiliki data spesifikasi untuk game ini. Silakan cek ulang nanti." },
  S: { emoji: "", label: "Sangat Optimal", color: "#e5b842", desc: "PC kamu jauh melampaui kebutuhan game ini. Pengalaman bermain akan sangat mulus." },
  A: { emoji: "", label: "Direkomendasikan", color: "#10b981", desc: "PC kamu memenuhi spesifikasi rekomendasi. Pengalaman bermain akan optimal." },
  B: { emoji: "", label: "Bisa (Minimum)", color: "#f59e0b", desc: "PC kamu hanya memenuhi spesifikasi minimum. Mungkin perlu setting grafis rendah." },
  C: { emoji: "", label: "Di Bawah Minimum", color: "#f97316", desc: "Beberapa komponen PC kamu berada di bawah minimum. Game mungkin tidak berjalan mulus." },
  D: { emoji: "", label: "Tidak Bisa Dijalankan", color: "#ef4444", desc: "PC kamu tidak memenuhi spesifikasi minimum game ini." },
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

function StatItem({ label, value }) {
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
        {label}
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

  // Comments state
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // comment id being replied to
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Request data state
  const [dataRequestCount, setDataRequestCount] = useState(0);
  const [dataRequestAlready, setDataRequestAlready] = useState(false);
  const [dataRequestLoading, setDataRequestLoading] = useState(false);

  const user = (() => { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } })();

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
        let url = `${API}/api/software/${gameId}`;
        if (specAvailable) {
          const p = new URLSearchParams({
            cpu: String(activeSpec.cpu),
            ram: String(activeSpec.ram),
            vram: String(activeSpec.vram),
            disk: String(activeSpec.disk),
            cpuName: activeSpec.cpuName,
            gpuName: activeSpec.gpuName,
          });
          url += `?${p.toString()}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("Game not found");
        const data = await res.json();
        setGame(data);
      } catch (err) {
        console.error("Gagal memuat data game", err);
        setGame(null);
      } finally {
        setLoading(false);
      }
    };
    loadGame();
    // Fire-and-forget: track view tanpa block page load
    fetch(`${API}/api/game/${gameId}/view`, { method: "POST" }).catch(() => {});
  }, [gameId, specAvailable]);

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      setCommentLoading(true);
      try {
        const res = await fetch(`${API}/api/game/${gameId}/comments`);
        const data = await res.json();
        setComments(data.comments || []);
      } catch (err) {
        console.error("Gagal memuat komentar", err);
      } finally {
        setCommentLoading(false);
      }
    };
    loadComments();
  }, [gameId]);

  // Load data request count
  useEffect(() => {
    const loadRequestCount = async () => {
      try {
        const headers = {};
        if (user?.token) headers["Authorization"] = String(user.token);
        const res = await fetch(`${API}/api/game/${gameId}/request-data/count`, { headers });
        const data = await res.json();
        setDataRequestCount(data.count || 0);
        setDataRequestAlready(data.already || false);
      } catch (err) {
        console.error("Gagal memuat request count", err);
      }
    };
    loadRequestCount();
  }, [gameId]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user?.token) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`${API}/api/game/${gameId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": String(user.token) },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText("");
        // Reload comments
        const r2 = await fetch(`${API}/api/game/${gameId}/comments`);
        const d2 = await r2.json();
        setComments(d2.comments || []);
      } else {
        const err = await res.json();
        alert(err.error || "Gagal mengirim komentar");
      }
    } catch (err) {
      alert("Gagal mengirim komentar");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Hapus komentar ini?")) return;
    try {
      const res = await fetch(`${API}/api/game/${gameId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Authorization": String(user.token) },
      });
      if (res.ok) {
        // Remove comment or reply from state
        setComments((prev) => prev
          .filter((c) => c.id !== commentId)
          .map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) }))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitReply = async (parentId) => {
    if (!replyText.trim() || !user?.token) return;
    setReplySubmitting(true);
    try {
      const res = await fetch(`${API}/api/game/${gameId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": String(user.token) },
        body: JSON.stringify({ content: replyText.trim(), parent_id: parentId }),
      });
      if (res.ok) {
        setReplyText("");
        setReplyingTo(null);
        // Reload comments
        const r2 = await fetch(`${API}/api/game/${gameId}/comments`);
        const d2 = await r2.json();
        setComments(d2.comments || []);
      } else {
        const err = await res.json();
        alert(err.error || "Gagal mengirim balasan");
      }
    } catch (err) {
      alert("Gagal mengirim balasan");
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleRequestData = async () => {
    if (!user?.token) {
      alert("Silakan login terlebih dahulu untuk request data game.");
      return;
    }
    setDataRequestLoading(true);
    try {
      const res = await fetch(`${API}/api/game/${gameId}/request-data`, {
        method: "POST",
        headers: { "Authorization": String(user.token) },
      });
      const data = await res.json();
      setDataRequestCount(data.count || 0);
      setDataRequestAlready(true);
    } catch (err) {
      alert("Gagal mengirim request");
    } finally {
      setDataRequestLoading(false);
    }
  };

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
      if (activeSpec) {
        if (label === "CPU") return activeSpec.cpuName || `${activeSpec.cpu} MHz`;
        if (label === "RAM") return `${activeSpec.ram} GB`;
        if (label === "GPU") return activeSpec.gpuName || `${activeSpec.vram} GB VRAM`;
        if (label === "Storage") return `${activeSpec.disk} GB`;
      }
      if (label === "CPU") return `${val} MHz`;
      if (label === "RAM") return `${val} GB`;
      if (label === "GPU") return `${val} GB VRAM`;
      if (label === "Storage") return `${val} GB`;
      return val;
    }
    if (raw) {
      if (label === "CPU") {
        const r = type === "min" ? raw.cpu_min : raw.cpu_rec;
        if (r && r !== "N/A") return splitConcatenatedSpecs(r);
      }
      if (label === "GPU") {
        const r = type === "min" ? raw.gpu_min : raw.gpu_rec;
        if (r && r !== "N/A") return splitConcatenatedSpecs(r);
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
    : { emoji: "", label: "Detail Game", color: "var(--accent2)", desc: "Lihat persyaratan sistem resmi untuk game ini di bawah. Masukkan spesifikasi PC Anda untuk membandingkan kecocokan." };

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
            background: "var(--bg3)", border: `2px solid ${gameColor}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }} />
        )}

        {/* Info */}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Game
          </div>
          <h1 style={{ fontFamily: "var(--font-primary)", fontWeight: 700, fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", lineHeight: 1.1, marginBottom: "0.75rem", letterSpacing: "0.02em" }}>
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

          <p style={{ fontFamily: "var(--font-body)", color: "var(--text2)", fontSize: "0.88rem", lineHeight: 1.6, marginBottom: "0.75rem", maxWidth: 560 }}>
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
            fontFamily: "var(--font-secondary)", fontWeight: 600, fontSize: "1.35rem",
            textAlign: "center", marginBottom: "0.5rem", color: "var(--accent)"
          }}>
            Cek Spesifikasi PC Kamu Sekarang
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
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.5rem" }}>Deteksi Otomatis</h4>
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
                {downloading ? "Downloading..." : "Download Detector"}
              </button>
            </div>

            {/* Quick manual form */}
            <form onSubmit={handleManualSubmit} style={{
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "1.25rem"
            }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem" }}>Input Cepat</h4>
              
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
          <h2 style={{ fontFamily: "var(--font-secondary)", fontWeight: 600, fontSize: "1.25rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
            Analisis Komponen
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {game.result.details.map((d) => {
              const statusColor = d.status === "optimal" ? "#10b981" : d.status === "minimum" ? "#f59e0b" : d.status === "unknown" ? "#94a3b8" : "#ef4444";
              const statusLabel = d.status === "optimal" ? "✓ Optimal" : d.status === "minimum" ? "~ Minimum" : d.status === "unknown" ? "? Unknown" : "✗ Di Bawah Min";
              const icons = { CPU: "CPU", RAM: "RAM", GPU: "GPU", Storage: "Disk" };
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
                      {icons[d.label] || d.label}
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
          <h2 style={{ fontFamily: "var(--font-secondary)", fontWeight: 600, fontSize: "1.2rem" }}>Tabel Spesifikasi</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--bg3)" }}>
                <th style={{ padding: "12px 20px", textAlign: "left", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  Komponen
                </th>
                <th style={{ padding: "12px 20px", textAlign: "left", color: "#f59e0b", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  Minimum
                </th>
                <th style={{ padding: "12px 20px", textAlign: "left", color: "#10b981", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  Rekomendasi
                </th>
                {isComparisonMode && (
                  <>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                      PC Kamu
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
                  const icons = { CPU: "CPU", RAM: "RAM", GPU: "GPU", Storage: "Disk" };
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
                        {icons[d.label] || d.label}
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
                  { label: "CPU", min: game.min_cpu, rec: game.rec_cpu, icon: "CPU" },
                  { label: "RAM", min: game.min_ram, rec: game.rec_ram, icon: "RAM" },
                  { label: "GPU", min: game.min_vram, rec: game.rec_vram, icon: "GPU" },
                  { label: "Storage", min: game.min_disk, rec: game.rec_disk, icon: "Disk" }
                ].map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                      background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "14px 20px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)" }}>
                      {row.icon}
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
            Rekomendasi
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {game.result.grade === "?" && (
              <>
                <RecommendItem text="Data persyaratan sistem untuk game ini belum tersedia di website ini." />
                <RecommendItem text="Kami akan terus memperbarui data secara berkala." />
              </>
            )}
            {game.result.grade === "S" && (
              <>
                <RecommendItem text="PC kamu sangat cocok untuk game ini. Mainkan di setting grafis Ultra / Max!" />
                <RecommendItem text="Coba aktifkan Ray Tracing atau resolusi tinggi (1440p / 4K) untuk pengalaman terbaik." />
                <RecommendItem text="Frame rate kemungkinan akan sangat tinggi. Pertimbangkan monitor 144Hz atau lebih." />
              </>
            )}
            {game.result.grade === "A" && (
              <>
                <RecommendItem text="PC kamu memenuhi spek rekomendasi. Mainkan di setting High atau Ultra." />
                <RecommendItem text="Pengalaman bermain akan lancar dan stabil di resolusi 1080p." />
              </>
            )}
            {game.result.grade === "B" && (
              <>
                <RecommendItem text="PC kamu hanya memenuhi spek minimum. Gunakan setting grafis Low atau Medium." />
                <RecommendItem text="Tutup aplikasi background untuk memaksimalkan performa." />
                <RecommendItem text="Pertimbangkan upgrade komponen yang ditandai di bawah minimum." />
              </>
            )}
            {game.result.grade === "C" && (
              <>
                <RecommendItem text="Beberapa komponen PC kamu berada di bawah minimum yang dibutuhkan." />
                <RecommendItem text="Game mungkin bisa berjalan dengan lag atau crash. Coba setting paling rendah." />
                <RecommendItem text="Sangat disarankan untuk upgrade komponen sebelum membeli game ini." />
              </>
            )}
            {game.result.grade === "D" && (
              <>
                <RecommendItem text="PC kamu tidak memenuhi spesifikasi minimum game ini." />
                <RecommendItem text="Upgrade hardware diperlukan sebelum bisa menjalankan game ini." />
                <RecommendItem text="Pertimbangkan bermain di cloud gaming seperti GeForce NOW atau Xbox Cloud Gaming." />
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
            Spesifikasi PC Kamu
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            <StatItem label="CPU" value={activeSpec.cpuName} />
            <StatItem label="RAM" value={`${activeSpec.ram} GB`} />
            <StatItem label="GPU" value={activeSpec.gpuName} />
            <StatItem label="Storage" value={`${activeSpec.disk} GB`} />
            <StatItem label="OS" value={activeSpec.os || "Windows"} />
          </div>
        </div>
      )}

      {/* ── REQUEST DATA BUTTON (for incomplete games) ── */}
      {game.result?.grade === "?" && (
        <div style={{
          background: "rgba(148, 163, 184, 0.06)",
          border: "1px solid rgba(148, 163, 184, 0.2)",
          borderRadius: 14,
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
          textAlign: "center",
        }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 6, color: "var(--text)" }}>
            Data Spesifikasi Belum Tersedia
          </div>
          <p style={{ color: "var(--text2)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "1rem", maxWidth: 500, margin: "0 auto 1rem" }}>
            Data spesifikasi untuk game ini belum lengkap. Klik tombol di bawah untuk meminta agar data segera dilengkapi.
          </p>
          {dataRequestCount > 0 && (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--accent)",
              marginBottom: "0.75rem",
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(0, 212, 255, 0.08)", borderRadius: 100, padding: "4px 14px",
              border: "1px solid rgba(0, 212, 255, 0.2)",
            }}>
              {dataRequestCount} orang sudah meminta data ini
            </div>
          )}
          <div>
            <button
              onClick={handleRequestData}
              disabled={dataRequestAlready || dataRequestLoading}
              style={{
                padding: "10px 28px", borderRadius: 10,
                background: dataRequestAlready ? "var(--bg3)" : "linear-gradient(135deg, var(--accent), #06b6d4)",
                color: dataRequestAlready ? "var(--text3)" : "#000",
                fontWeight: 700, fontSize: "0.88rem",
                border: dataRequestAlready ? "1px solid var(--border)" : "none",
                cursor: dataRequestAlready ? "default" : "pointer",
                opacity: dataRequestLoading ? 0.6 : 1,
                transition: "all 0.2s",
              }}
            >
              {dataRequestAlready ? "Sudah Di-request" : dataRequestLoading ? "Mengirim..." : "Request Data Lengkap"}
            </button>
          </div>
        </div>
      )}

      {/* ── COMMENTS SECTION ── */}
      <div style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.5rem",
        marginBottom: "1.5rem",
      }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
          Komentar ({comments.length})
        </h2>

        {/* Comment Input */}
        {user ? (
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.85rem", fontWeight: 800, color: "#000", flexShrink: 0,
              }}>
                {(user.username || "U")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
                  placeholder="Tulis komentar tentang game ini..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    background: "var(--bg3)", border: "1px solid var(--border)",
                    color: "var(--text)", fontSize: "0.85rem", resize: "vertical",
                    outline: "none", fontFamily: "inherit", lineHeight: 1.5,
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--accent2)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                    {commentText.length}/500
                  </span>
                  <button
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim() || commentSubmitting}
                    style={{
                      padding: "7px 20px", borderRadius: 8,
                      background: commentText.trim() ? "var(--accent2)" : "var(--bg3)",
                      color: commentText.trim() ? "#000" : "var(--text3)",
                      fontWeight: 700, fontSize: "0.8rem", border: "none",
                      cursor: commentText.trim() ? "pointer" : "default",
                      opacity: commentSubmitting ? 0.6 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    {commentSubmitting ? "..." : "Kirim →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: "center", padding: "1rem", marginBottom: "1rem",
            background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--border)",
          }}>
            <span style={{ color: "var(--text2)", fontSize: "0.85rem" }}>
              <button onClick={() => navigate("/login")} style={{ color: "var(--accent2)", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>Login</button> untuk meninggalkan komentar
            </span>
          </div>
        )}

        {/* Comment List */}
        {commentLoading ? (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text3)", fontSize: "0.85rem" }}>Memuat komentar...</div>
        ) : comments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text3)", fontSize: "0.85rem" }}>
            Belum ada komentar. Jadilah yang pertama!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {comments.map((c) => (
              <div key={c.id}>
                {/* Parent comment */}
                <div style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "12px 14px", background: "var(--bg3)",
                  borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)",
                  transition: "border-color 0.15s",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "rgba(167, 139, 250, 0.15)",
                    border: "1px solid rgba(167, 139, 250, 0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", fontWeight: 800, color: "#c084fc", flexShrink: 0,
                  }}>
                    {(c.username || "U")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--accent2)" }}>{c.username}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                        {c.created_at ? new Date(c.created_at + "Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      {user && (user.id === c.user_id || user.role === "admin") && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "0.72rem", opacity: 0.6, transition: "opacity 0.15s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = "#f87171"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.6; e.currentTarget.style.color = "var(--text3)"; }}
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text2)", lineHeight: 1.5, wordBreak: "break-word" }}>
                      {c.content}
                    </div>
                    {/* Balas button */}
                    {user && (
                      <button
                        onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyText(""); }}
                        style={{ marginTop: 6, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, padding: 0 }}
                      >
                        {replyingTo === c.id ? "✕ Batal" : "↩ Balas"}
                      </button>
                    )}
                    {/* Inline reply form */}
                    {replyingTo === c.id && (
                      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-end" }}>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Balas @${c.username}...`}
                          rows={2}
                          style={{
                            flex: 1, padding: "8px 10px", borderRadius: 8,
                            background: "var(--bg2)", border: "1px solid var(--border)",
                            color: "var(--text)", fontSize: "0.82rem", resize: "none", outline: "none",
                          }}
                          onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                          onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                        />
                        <button
                          onClick={() => handleSubmitReply(c.id)}
                          disabled={replySubmitting || !replyText.trim()}
                          style={{
                            padding: "8px 14px", borderRadius: 8, border: "none",
                            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                            color: "#000", fontWeight: 700, fontSize: "0.8rem",
                            cursor: replySubmitting ? "not-allowed" : "pointer", opacity: replySubmitting ? 0.7 : 1,
                          }}
                        >
                          {replySubmitting ? "..." : "Kirim"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Replies indented below */}
                {(c.replies || []).length > 0 && (
                  <div style={{ marginLeft: 42, marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                    {(c.replies || []).map((r) => (
                      <div key={r.id} style={{
                        display: "flex", gap: 8, alignItems: "flex-start",
                        padding: "10px 12px", background: "rgba(255,255,255,0.03)",
                        borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
                        borderLeft: "2px solid rgba(167,139,250,0.3)",
                      }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: "50%",
                          background: "rgba(0, 212, 255, 0.12)",
                          border: "1px solid rgba(0, 212, 255, 0.25)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.65rem", fontWeight: 800, color: "var(--accent)", flexShrink: 0,
                        }}>
                          {(r.username || "U")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--accent)" }}>{r.username}</span>
                            <span style={{ fontSize: "0.65rem", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                              {r.created_at ? new Date(r.created_at + "Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                            {user && (user.id === r.user_id || user.role === "admin") && (
                              <button
                                onClick={() => handleDeleteComment(r.id)}
                                style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "0.68rem", opacity: 0.6, transition: "opacity 0.15s" }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = "#f87171"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.6; e.currentTarget.style.color = "var(--text3)"; }}
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.5, wordBreak: "break-word" }}>
                            {r.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
            Reset Perbandingan
          </button>
        )}
      </div>
    </main>
  );
}

function RecommendItem({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.87rem", color: "var(--text2)", lineHeight: 1.5 }}>
      <span style={{ fontSize: "1rem", flexShrink: 0, color: "var(--text3)" }}>•</span>
      <span>{text}</span>
    </div>
  );
}
