# clean_duplicates.py
import os
import mysql.connector
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    print("=== Memulai Proses Pembersihan Game Duplikat di Database ===")
    
    # Koneksi ke database
    db_host = os.environ.get("DB_HOST", "db")
    db_user = os.environ.get("DB_USER", "speccheck")
    db_password = os.environ.get("DB_PASSWORD", "Sp3cCh3ck@Db#2026!xK9mPqR7")
    db_name = os.environ.get("DB_NAME", "speccheck")
    
    try:
        conn = mysql.connector.connect(
            host=db_host,
            user=db_user,
            password=db_password,
            database=db_name,
            charset='utf8mb4'
        )
        cursor = conn.cursor()
    except Exception as e:
        print(f"[ERROR] Gagal terhubung ke database di host '{db_host}': {e}")
        # Coba fallback ke localhost jika dijalankan di luar container
        try:
            print("Mencoba koneksi ke localhost...")
            conn = mysql.connector.connect(
                host="localhost",
                user=db_user,
                password=db_password,
                database=db_name,
                charset='utf8mb4'
            )
            cursor = conn.cursor()
        except Exception as local_err:
            print(f"[ERROR] Gagal terhubung ke localhost: {local_err}")
            return

    try:
        # Get count before
        cursor.execute("SELECT COUNT(*) FROM software WHERE cat = 'Game'")
        count_before = cursor.fetchone()[0]
        print(f"[INFO] Jumlah total game sebelum pembersihan: {count_before}")
        
        # Run cleanup query
        print("[INFO] Menghapus data duplikat (membandingkan case-insensitive & tanpa trailing spaces)...")
        cursor.execute("""
            DELETE FROM software 
            WHERE id NOT IN (
                SELECT min_id FROM (
                    SELECT MIN(id) AS min_id 
                    FROM software 
                    GROUP BY LOWER(TRIM(name))
                ) AS temp
            )
        """)
        conn.commit()
        
        # Get count after
        cursor.execute("SELECT COUNT(*) FROM software WHERE cat = 'Game'")
        count_after = cursor.fetchone()[0]
        print(f"[INFO] Jumlah total game setelah pembersihan: {count_after}")
        
        deleted = count_before - count_after
        print(f"[SUKSES] Berhasil menghapus {deleted} game duplikat dari database!")
        
        # Jalankan regenerasi PC Tiers JSON agar datanya ter-update
        print("[INFO] Menjalankan regenerasi PC Tiers JSON...")
        try:
            import analyze_tiers
            analyze_tiers.main()
        except Exception as tier_err:
            print(f"[WARNING] Gagal meregenerasi pc_tiers.json secara langsung: {tier_err}")
            
    except Exception as e:
        print(f"[ERROR] Terjadi kesalahan saat menghapus duplikat: {e}")
    finally:
        cursor.close()
        conn.close()
        print("=== Proses Pembersihan Selesai ===")

if __name__ == "__main__":
    main()
