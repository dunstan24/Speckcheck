# analyze_tiers.py
import os
import json
import time
from datetime import datetime
from dotenv import load_dotenv
import mysql.connector

# Load environment variables
load_dotenv()

from hardware_matcher import match_cpu, match_gpu


TIERS = [
    {
        "id": "under_10m",
        "name": "Entry-Level Gaming",
        "price_range": "Di bawah Rp 10 Juta (~Rp 7.5 - 8.5 Jt)",
        "specs_display": {
            "cpu": "Intel Core i3-12100F",
            "gpu": "NVIDIA GeForce GTX 1660 Super 6GB",
            "ram": "16 GB DDR4",
            "storage": "512 GB NVMe SSD"
        },
        "spec": {
            "cpuName": "Intel Core i3-12100F",
            "cpu": 10000,
            "gpuName": "NVIDIA GeForce GTX 1660 Super",
            "vram": 6.0,
            "ram": 16,
            "disk": 512
        }
    },
    {
        "id": "around_10m",
        "name": "Sweet-Spot",
        "price_range": "Rp 10 - 12 Juta (~Rp 10.5 - 11.5 Jt)",
        "specs_display": {
            "cpu": "AMD Ryzen 5 5600",
            "gpu": "NVIDIA GeForce RTX 3060 12GB",
            "ram": "16 GB DDR4 Dual Channel",
            "storage": "1 TB NVMe SSD"
        },
        "spec": {
            "cpuName": "AMD Ryzen 5 5600",
            "cpu": 21000,
            "gpuName": "NVIDIA GeForce RTX 3060",
            "vram": 12.0,
            "ram": 16,
            "disk": 1000
        }
    },
    {
        "id": "around_15m",
        "name": "High-Performance",
        "price_range": "Rp 15 - 17 Juta (~Rp 15.5 - 16.5 Jt)",
        "specs_display": {
            "cpu": "AMD Ryzen 5 7600",
            "gpu": "NVIDIA GeForce RTX 4060 Ti 8GB",
            "ram": "32 GB DDR5 Dual Channel",
            "storage": "1 TB NVMe SSD Gen 4"
        },
        "spec": {
            "cpuName": "AMD Ryzen 5 7600",
            "cpu": 26500,
            "gpuName": "NVIDIA GeForce RTX 4060 Ti",
            "vram": 8.0,
            "ram": 32,
            "disk": 1000
        }
    }
]

def get_connection():
    """Dapatkan koneksi DB. Coba host 'db' (Docker) dulu, lalu 'localhost' (Host)."""
    hosts = [os.environ.get("DB_HOST", "db"), "localhost", "127.0.0.1"]
    for host in hosts:
        try:
            conn = mysql.connector.connect(
                host=host,
                port=int(os.environ.get("DB_PORT", 3306)),
                database=os.environ.get("DB_NAME", "speccheck"),
                user=os.environ.get("DB_USER", "speccheck"),
                password=os.environ.get("DB_PASSWORD", ""),
                charset="utf8mb4",
                use_unicode=True
            )
            print(f"[ANALYZE-TIERS] Berhasil terhubung ke database di host: {host}")
            return conn
        except Exception:
            continue
    raise Exception("Tidak dapat terhubung ke database di host mana pun.")

def main():
    from app import row_to_sw, analyze_one
    print("[ANALYZE-TIERS] Memulai analisis kompatibilitas PC Tiers...")
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM software WHERE cat = 'Game' AND url IS NOT NULL AND url != ''")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[ANALYZE-TIERS] Error database: {e}")
        return

    total_games = len(rows)
    print(f"[ANALYZE-TIERS] Ditemukan {total_games} game di database.")

    if total_games == 0:
        print("[ANALYZE-TIERS] Tidak ada game untuk dianalisis. Batalkan.")
        return

    # Pre-resolve hardware scores for the tiers to avoid recalculating in loop
    tier_specs_processed = []
    for t in TIERS:
        spec = t["spec"]
        cpu_score, _ = match_cpu(spec["cpuName"], spec["cpu"])
        gpu_score, _ = match_gpu(spec["gpuName"], spec["vram"])
        tier_specs_processed.append({
            "id": t["id"],
            "name": t["name"],
            "price_range": t["price_range"],
            "specs_display": t["specs_display"],
            "spec": spec,
            "cpu_score": cpu_score,
            "gpu_score": gpu_score,
            "playable_count": 0,
            "optimal_count": 0
        })

    # Analyze each game against each tier
    for idx, row in enumerate(rows):
        sw = row_to_sw(row)
        for tp in tier_specs_processed:
            res = analyze_one(tp["spec"], sw, tp["cpu_score"], tp["gpu_score"])
            # Playable: Grade S, A, B
            if res["grade"] in ["S", "A", "B"]:
                tp["playable_count"] += 1
            # Optimal: Grade S, A
            if res["grade"] in ["S", "A"]:
                tp["optimal_count"] += 1

    # Format the results
    result_tiers = []
    for tp in tier_specs_processed:
        playable_percentage = round((tp["playable_count"] / total_games) * 100, 1) if total_games > 0 else 0
        optimal_percentage = round((tp["optimal_count"] / total_games) * 100, 1) if total_games > 0 else 0
        result_tiers.append({
            "id": tp["id"],
            "name": tp["name"],
            "price_range": tp["price_range"],
            "specs": tp["specs_display"],
            "playable_games_count": tp["playable_count"],
            "optimal_games_count": tp["optimal_count"],
            "playable_percentage": playable_percentage,
            "optimal_percentage": optimal_percentage
        })

    output_data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_games": total_games,
        "tiers": result_tiers
    }

    # Tentukan path output
    # 1. Jika di dalam container dengan mount volume ke /frontend_data
    if os.path.exists("/frontend_data"):
        output_path = "/frontend_data/pc_tiers.json"
    else:
        # 2. Jika dijalankan di host
        frontend_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "data"))
        os.makedirs(frontend_data_dir, exist_ok=True)
        output_path = os.path.join(frontend_data_dir, "pc_tiers.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"[ANALYZE-TIERS] Analisis selesai! Hasil disimpan ke: {output_path}")

if __name__ == "__main__":
    main()
