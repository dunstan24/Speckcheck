import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import softwareList from "../data/software";
import {
  analyzeSoftware,
  calculateStats,
  normalizeSpec,
} from "../utils/analyzer";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const proxyImageUrl = (url) => {
  if (!url) return null;
  return `${API}/api/image-proxy?url=${encodeURIComponent(url)}`;
};

const GRADE_INFO = {
  "?": { emoji: "❓", label: "Data Belum Tersedia", color: "#94a3b8" },
  S: { emoji: "🏆", label: "Sangat Optimal", color: "#22d3ee" },
  A: { emoji: "✅", label: "Direkomendasikan", color: "#4ade80" },
  B: { emoji: "⚠️", label: "Bisa (Minimum)", color: "#fbbf24" },
  C: { emoji: "⚡", label: "Di Bawah Minimum", color: "#fb923c" },
  D: { emoji: "❌", label: "Tidak Bisa", color: "#f87171" },
};

const cats = ["Semua", "Game"];

function Bar({ pct, color }) {
  return (
    <div
      style={{
        height: 4,
        background: "var(--bg3)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 2,
          transition: "width 0.8s ease",
        }}
      />
    </div>
  );
}

function SoftwareCard({ sw, onNavigate, isSpecAvailable }) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (!isSpecAvailable) {
    return (
      <div
        onClick={onNavigate}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "var(--bg2)",
          border: `1px solid ${hovered ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 12,
          overflow: "hidden",
          cursor: "pointer",
          transition: "all 0.2s ease",
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          boxShadow: hovered ? `0 8px 24px rgba(229, 184, 66, 0.1)` : "none",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          minHeight: 110,
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "var(--accent)",
          opacity: hovered ? 1 : 0.2,
          transition: "opacity 0.2s",
          borderRadius: "12px 12px 0 0",
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", paddingTop: 17 }}>
          {sw.cover_image_url && !imgError ? (
            <img
              src={proxyImageUrl(sw.cover_image_url)}
              alt={sw.name}
              onError={() => setImgError(true)}
              style={{
                width: 40,
                height: 54,
                objectFit: "cover",
                borderRadius: 6,
                border: "1px solid var(--border)",
                flexShrink: 0,
              }}
            />
          ) : (
            <span style={{ fontSize: "1.6rem", flexShrink: 0, width: 40, textAlign: "center" }}>🎮</span>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {sw.name}
            </div>
            <span style={{
              fontSize: "0.68rem",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              color: "var(--text2)",
              borderRadius: 4,
              padding: "2px 6px",
              fontFamily: "var(--font-mono)",
            }}>
              {sw.cat || "Game"}
            </span>
          </div>
        </div>

        <div style={{
          borderTop: "1px solid var(--border)",
          padding: "8px 16px",
          background: "rgba(255,255,255,0.01)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text3)", fontWeight: 600 }}>
            Spek Belum Dicek
          </span>
          <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
            Detail Game →
          </span>
        </div>
      </div>
    );
  }

  const g = GRADE_INFO[sw.result.grade] || { emoji: "❓", label: "Data Belum Tersedia", color: "#94a3b8" };
  const icons = { CPU: "🖥", RAM: "🧠", GPU: "🎴", Storage: "💾" };

  return (
    <div
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--bg2)",
        border: `1px solid ${hovered ? sw.result.color + "55" : "var(--border)"}`,
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? `0 8px 24px ${sw.result.color}18` : "none",
        position: "relative",
      }}
    >
      {/* Top color bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: sw.result.color,
        opacity: hovered ? 1 : 0.4,
        transition: "opacity 0.2s",
        borderRadius: "12px 12px 0 0",
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", paddingTop: 17 }}>
        {/* Cover image / icon */}
        {sw.cover_image_url && !imgError ? (
          <img
            src={proxyImageUrl(sw.cover_image_url)}
            alt={sw.name}
            onError={() => setImgError(true)}
            style={{
              width: 40,
              height: 54,
              objectFit: "cover",
              borderRadius: 6,
              border: "1px solid var(--border)",
              flexShrink: 0,
            }}
          />
        ) : (
          <span style={{ fontSize: "1.6rem", flexShrink: 0, width: 40, textAlign: "center" }}>{sw.icon || "🎮"}</span>
        )}

        {/* Name & bar */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sw.name}
          </div>
          <Bar pct={sw.result.totalScore} color={sw.result.color} />
          {/* Mini component status dots */}
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {sw.result.details.map((d) => {
              const c = d.status === "optimal" ? "#4ade80" : d.status === "minimum" ? "#fbbf24" : d.status === "unknown" ? "#94a3b8" : "#f87171";
              return (
                <span
                  key={d.label}
                  title={`${d.label}: ${d.status}`}
                  style={{
                    fontSize: "0.6rem",
                    background: c + "20",
                    border: `1px solid ${c}55`,
                    color: c,
                    borderRadius: 4,
                    padding: "1px 5px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                  }}
                >
                  {icons[d.label] || d.label[0]}
                </span>
              );
            })}
          </div>
        </div>

        {/* Grade + arrow */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 800,
            fontSize: "1.3rem",
            color: sw.result.color,
            lineHeight: 1,
          }}>
            {sw.result.grade}
          </div>
          <div style={{ fontSize: "0.6rem", color: "var(--text3)", textAlign: "center" }}>
            {sw.result.totalScore >= 0 ? `${sw.result.totalScore}/100` : "N/A"}
          </div>
          <span style={{ color: "var(--text3)", fontSize: "0.65rem", marginTop: 2 }}>→</span>
        </div>
      </div>

      {/* Grade label footer */}
      <div style={{
        borderTop: `1px solid ${sw.result.color}20`,
        padding: "6px 16px",
        background: sw.result.color + "08",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: "0.7rem", color: sw.result.color, fontWeight: 600 }}>
          {g.emoji} {g.label}
        </span>
        <span style={{ fontSize: "0.65rem", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
          Lihat detail →
        </span>
      </div>
    </div>
  );
}

export default function Results() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [specLoading, setSpecLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [gradeFilter, setGradeFilter] = useState("Semua");
  const [aiLoading, setAiLoading] = useState(false);
  const [specSaved, setSpecSaved] = useState(false);
  const [popularRunnable, setPopularRunnable] = useState([]);
  const location = useLocation();
  const justSaved = location.state?.justSaved || false;
  const [gameCount, setGameCount] = useState(null);
  const isGuest = !localStorage.getItem("user");

  const hasQuerySpec = params.get("cpu");

  // Auto-load saved spec jika user membuka /results tanpa query params
  useEffect(() => {
    // Fetch live game count
    const loadGameCount = async () => {
      try {
        const res = await fetch(`${API}/api/software/count`);
        const data = await res.json();
        setGameCount(data.count);
      } catch {
        setGameCount(null);
      }
    };
    loadGameCount();

    if (hasQuerySpec) {
      setSpecLoading(false);
      return;
    }

    const loadSavedSpec = async () => {
      const userStr = localStorage.getItem("user");
      let savedSpec = null;

      // 1. Coba fetch dari database jika user terlogin
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          const res = await fetch(`${API}/api/user/spec`, {
            headers: { 'Authorization': String(user.token || '') }
          });
          if (res.status === 401) {
            localStorage.removeItem("user");
            localStorage.removeItem("user_spec");
            window.dispatchEvent(new Event("authChange"));
            nav("/login");
            return;
          }
          const data = await res.json();
          if (data.spec) {
            savedSpec = data.spec;
            localStorage.setItem("user_spec", JSON.stringify(data.spec));
          }
        } catch (err) {
          console.error("Gagal fetch spec dari DB:", err);
        }
      }

      // 2. Fallback ke localStorage
      if (!savedSpec) {
        try {
          const localSpec = localStorage.getItem("user_spec");
          if (localSpec) {
            savedSpec = JSON.parse(localSpec);
          }
        } catch (err) {
          console.error("Gagal parse localStorage spec:", err);
        }
      }

      // 3. Jika ada spec tersimpan, set query params agar Results berjalan normal
      if (savedSpec && (savedSpec.cpu || savedSpec.ram || savedSpec.vram || savedSpec.disk)) {
        const p = new URLSearchParams({
          cpu: String(savedSpec.cpu || 0),
          ram: String(savedSpec.ram || 0),
          vram: String(savedSpec.vram || 0),
          disk: String(savedSpec.disk || 0),
          cpuName: savedSpec.cpuName || "Unknown CPU",
          gpuName: savedSpec.gpuName || "Unknown GPU",
          os: savedSpec.os || "Unknown OS",
        });
        setParams(p, { replace: true });
      } else {
        // Tidak ada spec tersimpan — biarkan memuat list tanpa spec
        setSpecLoading(false);
      }
      setSpecLoading(false);
    };

    loadSavedSpec();
  }, []);

  const spec = normalizeSpec({
    cpu: params.get("cpu") || 0,
    ram: params.get("ram") || 0,
    vram: params.get("vram") || 0,
    disk: params.get("disk") || 0,
    cpuName: params.get("cpuName") || "Unknown CPU",
    gpuName: params.get("gpuName") || "Unknown GPU",
    os: params.get("os") || "Unknown OS",
  });

  const isSpecAvailable = spec.cpu > 0;

  useEffect(() => {
    // Tunggu sampai spec selesai di-load
    if (specLoading) return;

    const loadData = async () => {
      if (!loading) {
        setIsSearching(true);
      }
      try {
        const res = await fetch(`${API}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...spec, q: searchQuery }),
        });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setResults(data.results);
        setStats(data.stats);
        setPopularRunnable(data.popularRunnable || []);
        setLoading(false);
        setIsSearching(false);
        if (spec.cpu > 0) {
          fetchAI(data.stats, data.results);
        } else {
          setSummary("");
        }
      } catch (err) {
        console.error("Gagal load analisis dari API, fallback ke local", err);
        // Fallback jika API bermasalah
        const localResults = analyzeSoftware(spec, softwareList);
        const localPopular = localResults.filter((r) => r.result.totalScore >= 50).slice(0, 10);
        const filtered = searchQuery
          ? localResults.filter((r) =>
              r.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : localResults.slice(0, 12);
        const localStats = calculateStats(filtered);
        setResults(filtered);
        setStats(localStats);
        setPopularRunnable(localPopular);
        setLoading(false);
        setIsSearching(false);
        if (spec.cpu > 0) {
          fetchAI(localStats, filtered);
        } else {
          setSummary("");
        }
      }
    };

    // Simpan spesifikasi ke localStorage & DB jika user terlogin dan spec valid (hanya dijalankan sekali pada inisialisasi)
    if (loading && spec.cpu > 0) {
      const saveSpec = async () => {
        try {
          localStorage.setItem("user_spec", JSON.stringify(spec));
        } catch (err) {
          console.error("Gagal menyimpan ke localStorage:", err);
        }

        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (user) {
          try {
            const saveRes = await fetch(`${API}/api/user/spec`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": String(user.token || ""),
              },
              body: JSON.stringify(spec),
            });
            if (saveRes.status === 401) {
              // Token diinvalidasi — force logout
              localStorage.removeItem("user");
              localStorage.removeItem("user_spec");
              window.dispatchEvent(new Event("authChange"));
            } else if (saveRes.ok && justSaved) {
              setSpecSaved(true);
              setTimeout(() => setSpecSaved(false), 3000);
            }
          } catch (err) {
            console.error("Gagal menyimpan spesifikasi user terlogin:", err);
          }
        }
      };
      saveSpec();
    }

    const delayDebounceFn = setTimeout(() => {
      loadData();
    }, searchQuery ? 500 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, spec.cpu, specLoading]);

  const fetchAI = async (st, activeResults) => {
    setAiLoading(true);
    try {
      const res = await fetch(`${API}/api/ai-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, stats: st }),
      });
      const d = await res.json();
      setSummary(d.summary);
    } catch {
      setSummary(
        "AI summary tidak tersedia saat ini. Silakan coba lagi nanti.",
      );
    }
    setAiLoading(false);
  };

  const filtered = results.filter((r) => {
    const catOk = filter === "Semua" || r.cat === filter;
    const gradeOk = gradeFilter === "Semua" || r.result.grade === gradeFilter;
    return catOk && gradeOk;
  });

  if (loading || specLoading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--accent)",
            animation: "pulse 1s infinite",
          }}
        >
          ⚙ Menganalisis...
        </div>
      </div>
    );

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "3rem 2rem",
        animation: "fadeUp 0.5s ease",
      }}
    >
      {/* Spec Saved Toast */}
      {specSaved && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          background: 'rgba(74, 222, 128, 0.15)',
          border: '1px solid rgba(74, 222, 128, 0.4)',
          borderRadius: 10, padding: '10px 18px',
          color: '#4ade80', fontSize: '0.82rem', fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          animation: 'fadeUp 0.3s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          ✅ Spek tersimpan ke akun Anda
        </div>
      )}

      {/* CTA for Guests */}
      {isGuest && isSpecAvailable && (
        <div style={{
          background: 'rgba(0, 212, 255, 0.06)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: 10, padding: '12px 18px',
          marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>
            💡 Masuk untuk menyimpan spek ini agar tidak perlu input ulang
          </span>
          <button
            onClick={() => nav('/login')}
            style={{
              background: 'rgba(0, 212, 255, 0.12)',
              border: '1px solid var(--accent)',
              borderRadius: 6, padding: '6px 16px',
              color: 'var(--accent)', fontWeight: 700,
              fontSize: '0.78rem', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#000' }}
            onMouseLeave={e => { e.target.style.background = 'rgba(0, 212, 255, 0.12)'; e.target.style.color = 'var(--accent)' }}
          >
            Masuk →
          </button>
        </div>
      )}

      {/* Spec Header */}
      {isSpecAvailable ? (
        <div style={{ marginBottom: "2.5rem" }}>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "1.8rem",
              letterSpacing: "-0.02em",
              marginBottom: 4,
            }}
          >
            Hasil <span style={{ color: "var(--accent)" }}>Analisis</span>
          </h1>
          {gameCount !== null && (
            <p style={{ color: "var(--text3)", fontSize: "0.82rem", marginBottom: 12 }}>
              Membandingkan spesifikasi PC Anda dengan {gameCount.toLocaleString("id-ID")} game di database.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "CPU", val: spec.cpuName },
              { label: "RAM", val: `${spec.ramGb}GB` },
              { label: "GPU", val: spec.gpuName },
              { label: "Storage", val: `${spec.diskFree}GB` },
              { label: "OS", val: spec.os },
            ].map(({ label, val }) => (
              <span
                key={label}
                style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  color: "var(--text2)",
                }}
              >
                <span style={{ color: "var(--text3)" }}>{label}:</span> {val}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: "2rem" }}>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "1.8rem",
              letterSpacing: "-0.02em",
              marginBottom: 4,
            }}
          >
            Daftar <span style={{ color: "var(--accent)" }}>Game</span>
          </h1>
          {gameCount !== null && (
            <p style={{ color: "var(--text3)", fontSize: "0.82rem", marginBottom: 12 }}>
              Menjelajahi {gameCount.toLocaleString("id-ID")} game di database.
            </p>
          )}
          
          {/* Test PC Banner */}
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                ⚡ Cek Apakah PC Kamu Kuat?
              </h3>
              <p style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>
                Bandingkan spesifikasi komputer Anda dengan database game kami untuk melihat grade performa secara instan.
              </p>
            </div>
            <button
              onClick={() => nav('/test-pc')}
              style={{
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.8rem',
                padding: '9px 18px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Uji PC Sekarang →
            </button>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div style={{ marginBottom: "2rem", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            color: "var(--text2)",
            textTransform: "uppercase"
          }}>
            Cari Game Spesifik
          </label>
          {isSearching && (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--accent)",
              animation: "pulse 1s infinite"
            }}>
              ⚡ Sedang mencari...
            </span>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Ketik judul game di sini... (contoh: Cyberpunk, GTA, Valorant)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 18px",
              paddingRight: "45px",
              borderRadius: 10,
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: "0.95rem",
              outline: "none",
              transition: "all 0.2s ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent)";
              e.target.style.boxShadow = "0 0 15px rgba(0, 212, 255, 0.15)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border)";
              e.target.style.boxShadow = "none";
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "var(--text3)",
                cursor: "pointer",
                fontSize: "1.1rem",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Bersihkan pencarian"
            >
              ✕
            </button>
          )}
        </div>
      </div>


      {/* Results Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "0.75rem",
          opacity: isSearching ? 0.4 : 1,
          transition: "opacity 0.25s ease",
        }}
      >
        {filtered.map((sw) => {
          const detailUrl = isSpecAvailable
            ? `/game/${sw.id}?cpu=${params.get("cpu") || 0}&ram=${params.get("ram") || 0}&vram=${params.get("vram") || 0}&disk=${params.get("disk") || 0}&cpuName=${encodeURIComponent(params.get("cpuName") || "")}&gpuName=${encodeURIComponent(params.get("gpuName") || "")}&os=${encodeURIComponent(params.get("os") || "")}`
            : `/game/${sw.id}`;
          return (
            <SoftwareCard
              key={sw.id}
              sw={sw}
              isSpecAvailable={isSpecAvailable}
              onNavigate={() => nav(detailUrl)}
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--text3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Tidak ada software untuk filter ini.
        </div>
      )}

      <button
        onClick={() => nav("/test-pc")}
        style={{
          display: "block",
          margin: "2rem auto 0",
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text2)",
          padding: "10px 28px",
          borderRadius: 8,
          fontWeight: 600,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.color = "var(--text2)";
        }}
      >
        ← Ubah Spesifikasi
      </button>
    </main>
  );
}
