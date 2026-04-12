"""SpecCheck.AI — Flask Backend"""
import os, json
import anthropic
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app)

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

db_path = os.path.join(os.path.dirname(__file__), "data", "software.json")
with open(db_path, "r", encoding="utf-8") as f:
    SOFTWARE_DB = json.load(f)

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
    return {"totalScore": total_score, "grade": grade, "label": lbl, "color": color, "details": details}

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "SpecCheck.AI Backend berjalan"})

@app.route("/api/software")
def get_software():
    return jsonify(SOFTWARE_DB)

@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.json
    spec = {"cpu": int(data.get("cpu",0)), "ram": int(data.get("ram",0)),
            "vram": float(data.get("vram",0)), "disk": int(data.get("disk",0))}
    results = [{**sw, "result": analyze_one(spec, sw)} for sw in SOFTWARE_DB]
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

Spesifikasi PC: CPU: {spec.get('cpuName','Unknown')}, RAM: {spec.get('ramGb',0)}GB, GPU: {spec.get('gpuName','Unknown')} ({spec.get('vram',0)}GB VRAM), Storage: {spec.get('diskFree',0)}GB tersedia

Hasil: Bisa dijalankan: {stats.get('canRun',0)}/30, Optimal: {stats.get('optimal',0)}/30, Tidak memadai: {stats.get('cantRun',0)}/30

Tulis ringkasan 3-4 kalimat: kesimpulan umum, highlight unggulan, dan satu saran upgrade jika perlu. Bahasa santai dan friendly."""
    try:
        msg = client.messages.create(model="claude-sonnet-4-20250514", max_tokens=400,
                                     messages=[{"role":"user","content":prompt}])
        summary = msg.content[0].text
    except Exception as e:
        summary = f"PC kamu berhasil dianalisis! Lihat hasil lengkap di bawah. (AI: {str(e)[:60]})"
    return jsonify({"summary": summary})

@app.route("/api/download-detector")
def download_detector():
    exe_path = os.path.join(os.path.dirname(__file__), "..", "detector", "dist", "SpecCheck_Detect.exe")
    if os.path.exists(exe_path):
        return send_file(exe_path, as_attachment=True, download_name="SpecCheck_Detect.exe")
    py_path = os.path.join(os.path.dirname(__file__), "..", "detector", "speccheck_detect.py")
    if os.path.exists(py_path):
        return send_file(py_path, as_attachment=True, download_name="SpecCheck_Detect.py")
    return jsonify({"error": "Detector belum tersedia."}), 404

if __name__ == "__main__":
    print("\n  ╔══════════════════════════════════════╗")
    print("  ║   SpecCheck.AI Backend — Running     ║")
    print("  ║   http://localhost:5000              ║")
    print("  ╚══════════════════════════════════════╝\n")
    app.run(debug=True, port=5000)
