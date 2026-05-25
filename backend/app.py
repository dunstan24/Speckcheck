"""SpecCheck.AI — Flask Backend (MySQL edition)"""
import os, time
import mysql.connector
import google.generativeai as genai
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

# ─── Database ────────────────────────────────────────────────────────────────

def get_db_connection():
    """Buat koneksi ke MySQL. Retry otomatis jika DB belum siap (startup race)."""
    for attempt in range(10):
        try:
            return mysql.connector.connect(
                host=os.environ.get("DB_HOST", "localhost"),
                port=int(os.environ.get("DB_PORT", 3306)),
                database=os.environ.get("DB_NAME", "speccheck"),
                user=os.environ.get("DB_USER", "speccheck"),
                password=os.environ.get("DB_PASSWORD", "speccheck123"),
            )
        except mysql.connector.Error:
            if attempt < 9:
                print(f"  DB belum siap, retry {attempt+1}/10...")
                time.sleep(3)
            else:
                raise

def fetch_all_software():
    """Ambil semua software dari MySQL dan kembalikan dalam format dict."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM software ORDER BY id")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {
            "id":   r["id"],
            "name": r["name"],
            "cat":  r["cat"],
            "icon": r["icon"],
            "min":  {"cpu": r["min_cpu"], "ram": r["min_ram"],
                     "vram": float(r["min_vram"]), "disk": r["min_disk"]},
            "rec":  {"cpu": r["rec_cpu"], "ram": r["rec_ram"],
                     "vram": float(r["rec_vram"]), "disk": r["rec_disk"]},
            "url":             r.get("url"),
            "description":     r.get("description"),
            "cover_image_url": r.get("cover_image_url"),
            "raw": {
                "cpu_min": r.get("raw_cpu_min"),
                "gpu_min": r.get("raw_gpu_min"),
                "cpu_rec": r.get("raw_cpu_rec"),
                "gpu_rec": r.get("raw_gpu_rec")
            }
        }
        for r in rows
    ]

# ─── Analisis ────────────────────────────────────────────────────────────────

def analyze_one(spec, sw):
    checks = [
        ("CPU",     spec["cpu"],  sw["min"]["cpu"],  sw["rec"]["cpu"]),
        ("RAM",     spec["ram"],  sw["min"]["ram"],  sw["rec"]["ram"]),
        ("GPU",     spec["vram"], sw["min"]["vram"], sw["rec"]["vram"]),
        ("Storage", spec["disk"], sw["min"]["disk"], sw["rec"]["disk"]),
    ]
    total_score = 0
    details = []
    for label, user, mn, rec in checks:
        if mn == 0 and rec == 0:
            status, score, pct = "optimal", 25, 100
        elif user >= rec:
            status, score, pct = "optimal", 25, 100
        elif user >= mn:
            score = 15
            pct = 50 + ((user - mn) / max(rec - mn, 1)) * 50
            status = "minimum"
        else:
            score = 0
            pct = (user / max(mn, 1)) * 50
            status = "below"
        total_score += score
        details.append({"label": label, "user": user, "min": mn, "rec": rec,
                        "status": status, "pct": round(min(pct, 100))})
    if total_score >= 90:   grade, lbl, color = "S", "Sangat Optimal",   "#22d3ee"
    elif total_score >= 70: grade, lbl, color = "A", "Direkomendasikan", "#4ade80"
    elif total_score >= 50: grade, lbl, color = "B", "Bisa (Minimum)",   "#fbbf24"
    elif total_score >= 25: grade, lbl, color = "C", "Di Bawah Minimum", "#fb923c"
    else:                   grade, lbl, color = "D", "Tidak Bisa",       "#f87171"
    return {"totalScore": total_score, "grade": grade, "label": lbl,
            "color": color, "details": details}

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "SpecCheck.AI Backend berjalan"})

@app.route("/api/software")
def get_software():
    return jsonify(fetch_all_software())

@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.json
    spec = {"cpu": int(data.get("cpu", 0)), "ram": int(data.get("ram", 0)),
            "vram": float(data.get("vram", 0)), "disk": int(data.get("disk", 0))}
    software_db = fetch_all_software()
    results = [{**sw, "result": analyze_one(spec, sw)} for sw in software_db]
    stats = {
        "canRun":  sum(1 for r in results if r["result"]["totalScore"] >= 50),
        "optimal": sum(1 for r in results if r["result"]["totalScore"] >= 90),
        "cantRun": sum(1 for r in results if r["result"]["totalScore"] < 25),
        "gamesOk": sum(1 for r in results if r["cat"] == "Game" and r["result"]["totalScore"] >= 70),
        "total":   len(results),
    }
    return jsonify({"results": results, "stats": stats})

@app.route("/api/ai-summary", methods=["POST"])
def ai_summary():
    data = request.json
    spec, stats = data.get("spec", {}), data.get("stats", {})
    prompt = f"""Kamu adalah asisten AI untuk SpecCheck.AI. Buat ringkasan analisis PC dalam Bahasa Indonesia yang ramah dan mudah dipahami pengguna awam.

Spesifikasi PC: CPU: {spec.get('cpuName','Unknown')}, RAM: {spec.get('ramGb',0)}GB, GPU: {spec.get('gpuName','Unknown')} ({spec.get('vram',0)}GB VRAM), Storage: {spec.get('diskFree',0)}GB tersedia, OS: {spec.get('os','Unknown')}

Hasil: Bisa dijalankan: {stats.get('canRun',0)}/30, Optimal: {stats.get('optimal',0)}/30, Tidak memadai: {stats.get('cantRun',0)}/30

Tulis ringkasan 3-4 kalimat: kesimpulan umum, highlight unggulan, dan satu saran upgrade jika perlu. Bahasa santai dan friendly."""
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        summary = response.text
    except Exception:
        can_run  = stats.get('canRun', 0)
        optimal  = stats.get('optimal', 0)
        cant_run = stats.get('cantRun', 0)
        total    = stats.get('total', 30)
        cpu_name = spec.get('cpuName', 'prosesormu')
        summary = (
            f"✨ Fitur ringkasan AI segera hadir! "
            f"Sementara itu, berikut hasil analisis singkat PC kamu: "
            f"dari {total} software yang dicek, "
            f"{can_run} bisa dijalankan, {optimal} berjalan optimal, "
            f"dan {cant_run} di luar kemampuan PC saat ini. "
            f"{cpu_name} kamu sudah cukup mumpuni — "
            f"scroll ke bawah untuk lihat detail lengkapnya! 🚀"
        )
    return jsonify({"summary": summary})

@app.route("/api/download-detector")
def download_detector():
    # Definisikan semua path kemungkinan (baik absolut Docker maupun relatif host)
    exe_paths = [
        "/detector/dist/SpecCheck_Detect.exe",
        "/detector/SpecCheck_Detect.exe",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "detector", "dist", "SpecCheck_Detect.exe")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "detector", "SpecCheck_Detect.exe")),
    ]
    py_paths = [
        "/detector/speccheck_detect.py",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "detector", "speccheck_detect.py")),
    ]

    print("\n[DOWNLOAD DETECTOR] Mencari file detector...")
    
    # 1. Coba cari file .exe dulu
    for p in exe_paths:
        exists = os.path.exists(p)
        print(f"  - Cek EXE path: {p} -> {'ADA' if exists else 'TIDAK ADA'}")
        if exists:
            print(f"  -> Mengirim file EXE: {p} (Size: {os.path.getsize(p)} bytes)")
            return send_file(p, as_attachment=True, download_name="SpecCheck_Detect.exe")

    # 2. Coba cari file .py jika .exe tidak ada
    for p in py_paths:
        exists = os.path.exists(p)
        print(f"  - Cek PY path: {p} -> {'ADA' if exists else 'TIDAK ADA'}")
        if exists:
            print(f"  -> Mengirim file PY: {p}")
            return send_file(p, as_attachment=True, download_name="speccheck_detect.py")

    print("  [ERROR] File detector tidak ditemukan sama sekali di kontainer!")
    return jsonify({"error": "Detector belum tersedia."}), 404

if __name__ == "__main__":
    print("\n  ╔══════════════════════════════════════╗")
    print("  ║   SpecCheck.AI Backend — Running     ║")
    print("  ║   http://localhost:5000              ║")
    print("  ╚══════════════════════════════════════╝\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
