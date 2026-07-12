# SpecCheck.AI - PCGamingWiki Ingestor Script
# File ini membaca CSV dari folder /data, mem-parsing datanya, lalu menyimpannya ke MySQL.

import os
import csv
import re
import math
import glob
import mysql.connector

# Ambil konfigurasi database dari environment
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")  # Gunakan 127.0.0.1 jika dijalankan di host, db jika di container
DB_USER = os.getenv("DB_USER", "speccheck")
DB_PASSWORD = os.getenv("DB_PASSWORD", "speccheck123")
DB_NAME = os.getenv("DB_NAME", "speccheck")

def parse_cpu(cpu_str):
    if not cpu_str or cpu_str.strip() == "" or cpu_str == "N/A":
        return 0
    cpu_str_lower = cpu_str.lower()
    
    # 1. Cari pola GHz (contoh: 2.4 GHz atau 3.0GHz)
    match_ghz = re.search(r'(\d+(?:\.\d+)?)\s*ghz', cpu_str_lower)
    if match_ghz:
        return int(float(match_ghz.group(1)) * 1000)
        
    # 2. Cari pola MHz (contoh: 800 MHz)
    match_mhz = re.search(r'(\d+)\s*mhz', cpu_str_lower)
    if match_mhz:
        return int(match_mhz.group(1))
        
    # 3. Klasifikasi kata kunci arsitektur / tipe core
    if "quad" in cpu_str_lower or "4 core" in cpu_str_lower:
        return 2400
    if "dual" in cpu_str_lower or "2 core" in cpu_str_lower:
        return 2000
    if "i5" in cpu_str_lower or "i7" in cpu_str_lower or "ryzen" in cpu_str_lower:
        return 2500
    if "pentium 4" in cpu_str_lower or "athlon 64" in cpu_str_lower:
        return 1800
    if "pentium iii" in cpu_str_lower or "pentium 3" in cpu_str_lower:
        return 800
        
    # 4. Cari angka desimal/bulat pertama sebagai tebakan GHz/MHz
    match_num = re.search(r'(\d+(?:\.\d+)?)', cpu_str)
    if match_num:
        val = float(match_num.group(1))
        if val < 10.0:  # Tebakan GHz
            return int(val * 1000)
        elif val >= 100.0:  # Tebakan MHz
            return int(val)
            
    return 1500  # Default fallback jika tidak ada angka sama sekali

def parse_ram(ram_str):
    if not ram_str or ram_str.strip() == "" or ram_str == "N/A":
        return 0
    ram_str_lower = ram_str.lower()
    
    # 1. Cari pola GB (contoh: 4 GB atau 8GB)
    match_gb = re.search(r'(\d+(?:\.\d+)?)\s*gb', ram_str_lower)
    if match_gb:
        return int(float(match_gb.group(1)))
        
    # 2. Cari pola MB (contoh: 512 MB atau 80MB)
    match_mb = re.search(r'(\d+)\s*mb', ram_str_lower)
    if match_mb:
        mb_val = int(match_mb.group(1))
        return 1 if mb_val > 500 else 0  # Di bawah 500MB dihitung 0GB (sangat kecil untuk standar modern)
        
    # 3. Tebakan angka pertama
    match_num = re.search(r'(\d+)', ram_str_lower)
    if match_num:
        val = int(match_num.group(1))
        if val > 16:  # Jika angkanya besar, kemungkinan besar satuan MB
            return 1 if val > 500 else 0
        return val
        
    return 2  # Default fallback

def parse_vram(gpu_str):
    if not gpu_str or gpu_str.strip() == "" or gpu_str == "N/A":
        return 0.0
    gpu_str_lower = gpu_str.lower()
    
    # 1. Cari penyebutan VRAM eksplisit (contoh: "512 MB of VRAM", "2 GB VRAM")
    match_vram_gb = re.search(r'(\d+(?:\.\d+)?)\s*gb\s*(?:of\s*)?vram', gpu_str_lower)
    if match_vram_gb:
        return float(match_vram_gb.group(1))
    match_vram_mb = re.search(r'(\d+)\s*mb\s*(?:of\s*)?vram', gpu_str_lower)
    if match_vram_mb:
        return round(int(match_vram_mb.group(1)) / 1024.0, 2)
        
    # 2. Cari penyebutan GB/MB umum pada GPU
    match_gb = re.search(r'(\d+(?:\.\d+)?)\s*gb', gpu_str_lower)
    if match_gb:
        return float(match_gb.group(1))
    match_mb = re.search(r'(\d+)\s*mb', gpu_str_lower)
    if match_mb:
        return round(int(match_mb.group(1)) / 1024.0, 2)
        
    # 3. Deteksi tipe GPU terkenal dan tetapkan VRAM perkiraan
    if "nvidia" in gpu_str_lower or "geforce" in gpu_str_lower:
        if any(x in gpu_str_lower for x in ["rtx 3080", "rtx 4080", "rtx 2080", "gtx 1080"]):
            return 8.0
        if any(x in gpu_str_lower for x in ["rtx 3060", "rtx 4060", "rtx 2060", "gtx 1060"]):
            return 6.0
        if any(x in gpu_str_lower for x in ["gtx 1050", "gtx 960", "gtx 760"]):
            return 4.0
        if any(x in gpu_str_lower for x in ["gtx 750", "gtx 660", "gt 1030"]):
            return 2.0
        return 1.0
        
    if "radeon" in gpu_str_lower or "amd" in gpu_str_lower:
        if "rx" in gpu_str_lower:
            return 4.0
        return 1.0
        
    if "intel hd" in gpu_str_lower or "intel iris" in gpu_str_lower or "graphics" in gpu_str_lower:
        return 0.5  # Shared memory / Integrated
        
    return 0.25  # Fallback minimum (DirectX 9/10 lama)

def parse_storage(storage_str):
    if not storage_str or storage_str.strip() == "" or storage_str == "N/A":
        return 0
    storage_str_lower = storage_str.lower()
    
    # 1. Cari pola GB (contoh: 20 GB atau 100GB)
    match_gb = re.search(r'(\d+(?:\.\d+)?)\s*gb', storage_str_lower)
    if match_gb:
        return int(float(match_gb.group(1)))
        
    # 2. Cari pola MB (contoh: 500 MB atau 80MB)
    match_mb = re.search(r'(\d+)\s*mb', storage_str_lower)
    if match_mb:
        mb_val = int(match_mb.group(1))
        return int(math.ceil(mb_val / 1024.0)) or 1
        
    # 3. Tebakan angka pertama
    match_num = re.search(r'(\d+)', storage_str_lower)
    if match_num:
        val = int(match_num.group(1))
        if val > 150:  # Tebakan MB
            return int(math.ceil(val / 1024.0)) or 1
        return val
        
    return 5  # Fallback standard minimum game

def find_all_csv_files():
    """Temukan SEMUA file CSV di folder data, urutkan berdasarkan nama."""
    paths = ["/data/*.csv", "./data/*.csv", "../data/*.csv", "data/*.csv"]
    for p in paths:
        files = glob.glob(p)
        if files:
            files.sort()
            return files
    return []

def check_and_add_columns(cursor):
    """Pastikan kolom ada dan ukurannya cukup besar (self-migrating)."""
    columns_to_add = [
        ("url",             "VARCHAR(500) NULL"),
        ("description",     "TEXT NULL"),
        ("cover_image_url", "TEXT NULL"),
        ("raw_cpu_min",     "TEXT NULL"),
        ("raw_gpu_min",     "TEXT NULL"),
        ("raw_cpu_rec",     "TEXT NULL"),
        ("raw_gpu_rec",     "TEXT NULL")
    ]
    
    # Dapatkan kolom yang sudah ada
    cursor.execute("SHOW COLUMNS FROM software")
    existing_cols = [row[0] for row in cursor.fetchall()]
    
    for col_name, col_type in columns_to_add:
        if col_name not in existing_cols:
            print(f"[MIGRATION] Menambahkan kolom '{col_name}'...")
            cursor.execute(f"ALTER TABLE software ADD COLUMN {col_name} {col_type}")

    # Perbesar kolom yang mungkin terlalu kecil dari versi lama
    resize_cols = [
        ("name",            "VARCHAR(500) NOT NULL"),
        ("cover_image_url", "TEXT NULL"),
        ("raw_cpu_min",     "TEXT NULL"),
        ("raw_gpu_min",     "TEXT NULL"),
        ("raw_cpu_rec",     "TEXT NULL"),
        ("raw_gpu_rec",     "TEXT NULL"),
    ]
    for col_name, col_type in resize_cols:
        try:
            cursor.execute(f"ALTER TABLE software MODIFY COLUMN {col_name} {col_type}")
        except Exception:
            pass  # Sudah benar, abaikan

    # Pastikan kolom id punya AUTO_INCREMENT
    try:
        cursor.execute("""
            ALTER TABLE software MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT
        """)
        print("[MIGRATION] Kolom 'id' diset ke AUTO_INCREMENT.")
    except Exception:
        pass  # Sudah AUTO_INCREMENT, abaikan


MAX_INT = 2_147_483_647  # Batas MySQL INT

def trunc(value, max_len):
    """Potong string agar tidak melebihi batas kolom."""
    if value and len(value) > max_len:
        return value[:max_len]
    return value

def clamp_int(value):
    """Pastikan nilai integer tidak melebihi batas MySQL INT."""
    return max(0, min(int(value), MAX_INT))

def main():
    print("=== SpecCheck.AI - Memulai Proses Ingest Data PCGamingWiki ===")
    
    csv_files = find_all_csv_files()
    if not csv_files:
        print("[ERROR] Tidak ada file CSV ditemukan di folder /data!")
        return
        
    print(f"[INFO] Menemukan {len(csv_files)} file CSV:")
    for f in csv_files:
        print(f"  - {f}")
    
    # Koneksi ke database MySQL
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci'
        )
        cursor = conn.cursor()
        print("[INFO] Berhasil terhubung ke database MySQL.")
    except Exception as e:
        print(f"[ERROR] Gagal terhubung ke MySQL: {e}")
        print("Pastikan database MySQL kontainer sedang menyala (docker compose up).")
        return

    # Lakukan migrasi skema tabel jika diperlukan
    try:
        check_and_add_columns(cursor)
        conn.commit()
        print("[INFO] Migrasi skema database berhasil/diverifikasi.")
    except Exception as e:
        print(f"[ERROR] Gagal melakukan migrasi database: {e}")
        conn.close()
        return

    # 1. Hapus semua game lama terlebih dahulu agar tidak duplikat
    try:
        cursor.execute("DELETE FROM software WHERE cat = 'Game'")
        conn.commit()
        print("[INFO] Berhasil menghapus data game lama di database.")
    except Exception as e:
        print(f"[ERROR] Gagal menghapus game lama: {e}")
        conn.close()
        return

    # 2. Baca SEMUA file CSV satu per satu
    games_inserted = 0
    games_skipped = 0

    insert_query = """
        INSERT INTO software (
            name, cat, icon, 
            min_cpu, min_ram, min_vram, min_disk, 
            rec_cpu, rec_ram, rec_vram, rec_disk,
            url, description, cover_image_url,
            raw_cpu_min, raw_gpu_min, raw_cpu_rec, raw_gpu_rec
        ) VALUES (
            %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s
        )
    """

    try:
        for csv_file in csv_files:
            file_count = 0
            print(f"\n[FILE] Membaca: {csv_file}")
            try:
                with open(csv_file, mode='r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    
                    for row in reader:
                        title = row.get("Title", "").strip()
                        if not title:
                            continue

                        # Truncate nama game agar muat di VARCHAR(500)
                        title = trunc(title, 499)
                        
                        # Parsing spesifikasi numerik minimum — clamp agar tidak overflow INT
                        min_cpu  = clamp_int(parse_cpu(row.get("CPU_Minimum", "")))
                        min_ram  = clamp_int(parse_ram(row.get("RAM_Minimum", "")))
                        min_vram = parse_vram(row.get("GPU_Minimum", ""))
                        min_disk = clamp_int(parse_storage(row.get("Storage_Minimum", "")))
                        
                        # Parsing spesifikasi numerik rekomendasi
                        rec_cpu  = clamp_int(parse_cpu(row.get("CPU_Recommended", "")))
                        rec_ram  = clamp_int(parse_ram(row.get("RAM_Recommended", "")))
                        rec_vram = parse_vram(row.get("GPU_Recommended", ""))
                        rec_disk = clamp_int(parse_storage(row.get("Storage_Recommended", "")))
                        
                        # Bersihkan deskripsi "N/A"
                        desc = row.get("Description", "").strip()
                        if desc == "N/A":
                            desc = ""
                        
                        # cover image
                        cover = row.get("Cover_Image_URL", "").strip()
                        if cover == "N/A":
                            cover = ""

                        vals = (
                            title,
                            "Game",
                            "🎮",
                            min_cpu, min_ram, min_vram, min_disk,
                            rec_cpu, rec_ram, rec_vram, rec_disk,
                            trunc(row.get("URL", "").strip(), 499),
                            desc,
                            cover,  # TEXT — tidak perlu truncate
                            row.get("CPU_Minimum", "").strip(),
                            row.get("GPU_Minimum", "").strip(),
                            row.get("CPU_Recommended", "").strip(),
                            row.get("GPU_Recommended", "").strip()
                        )
                        
                        try:
                            cursor.execute(insert_query, vals)
                            games_inserted += 1
                            file_count += 1
                        except Exception as e:
                            print(f"  - [WARNING] Gagal memasukkan game '{title}': {e}")
                            games_skipped += 1

                conn.commit()
                print(f"  -> {file_count} game diimpor dari file ini.")

            except Exception as e:
                print(f"  [ERROR] Gagal membaca file {csv_file}: {e}")

        print(f"\n[SUKSES] Total {games_inserted} game berhasil diimpor dari {len(csv_files)} file CSV!")
        if games_skipped > 0:
            print(f"[INFO] {games_skipped} baris dilewati karena error.")
        
    except Exception as e:
        print(f"[ERROR] Terjadi kesalahan fatal: {e}")
        
    finally:
        cursor.close()
        conn.close()
        print("=== Proses Ingest Selesai ===")

if __name__ == "__main__":
    main()
