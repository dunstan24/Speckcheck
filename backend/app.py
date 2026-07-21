"""Bisa main nggak? — Flask Backend (MySQL edition)"""
import os, time, secrets, smtplib, random, string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests as req_lib
from hardware_matcher import match_cpu, match_gpu, resolve_game_requirement, get_cpus, get_gpus, mhz_to_score, extract_vram_from_name
import mysql.connector
import google.generativeai as genai
from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

# ── In-Memory Image Cache ─────────────────────────────────────────────────────
# Menyimpan gambar yang sudah pernah di-download untuk menghindari request ulang
# Format: { url: { 'data': bytes, 'content_type': str, 'expires': float } }
_IMAGE_CACHE: dict = {}
_IMAGE_CACHE_TTL = 24 * 60 * 60  # 24 jam

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://bisamainnggak.com")

# Izinkan CORS untuk semua origin (termasuk https://bisamainnggak.com dan www.bisamainnggak.com)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Rate Limiter (in-memory storage untuk single-instance)
limiter = Limiter(get_remote_address, app=app, default_limits=[],
                  storage_uri="memory://")

from werkzeug.exceptions import HTTPException

@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        response = e.get_response()
        from flask import json
        response.data = json.dumps({
            "code": e.code,
            "name": e.name,
            "description": e.description,
            "error": e.description,
            "message": e.description
        })
        response.content_type = "application/json"
        return response

    app.logger.error(f"Internal Server Error: {e}", exc_info=True)
    return jsonify({
        "error": "Maaf, fitur ini sedang dalam perbaikan atau tidak dapat diakses saat ini. Silakan coba beberapa saat lagi. (Sorry, this feature is currently down or under maintenance.)",
        "message": "Maaf, fitur ini sedang dalam perbaikan atau tidak dapat diakses saat ini. Silakan coba beberapa saat lagi. (Sorry, this feature is currently down or under maintenance.)"
    }), 500

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# ─── Security Token System (with token_version & expiry) ─────────────────────
import hmac
import hashlib
import base64
import json

# Hasilkan secret key yang aman jika tidak diatur di env atau menggunakan nilai default-nya
env_secret = os.environ.get("FLASK_SECRET", "").strip()
if not env_secret or env_secret == "CHANGE_THIS_TO_A_RANDOM_SECRET_KEY" or env_secret == "speccheck_secure_key_2026":
    import secrets
    # Simpan di memory agar persisten sepanjang runtime aplikasi
    SECRET_KEY = secrets.token_hex(32)
    print("[SECURITY WARNING] FLASK_SECRET tidak diatur atau memakai default. Menggunakan kunci acak sementara.")
else:
    SECRET_KEY = env_secret
TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60  # 7 hari

def generate_token(user_id, role, token_version=0):
    payload = json.dumps({
        "user_id": int(user_id),
        "role": str(role),
        "tv": int(token_version),
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS
    }).encode('utf-8')
    sig = hmac.new(SECRET_KEY.encode('utf-8'), payload, hashlib.sha256).digest()
    token = base64.urlsafe_b64encode(payload + b"." + sig).decode('utf-8')
    return token

def verify_token(token):
    """Verify token signature, expiry, AND token_version against database."""
    if not token:
        return None, None
    if isinstance(token, str) and token.startswith("Bearer "):
        token = token[7:]
    token = token.strip()
    try:
        decoded = base64.urlsafe_b64decode(token.encode('utf-8'))
        parts = decoded.split(b".")
        if len(parts) != 2:
            return None, None
        payload, sig = parts[0], parts[1]
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), payload, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected_sig):
            return None, None
        data = json.loads(payload.decode('utf-8'))
        # Check expiry
        if data.get("exp", 0) < time.time():
            return None, None
        # Check token_version against database
        user_id = data.get("user_id")
        token_tv = data.get("tv", 0)
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT token_version FROM users WHERE id = %s", (user_id,))
            row = cursor.fetchone()
            cursor.close()
            conn.close()
            if not row:
                return None, None
            if row["token_version"] != token_tv:
                return None, None  # Token invalidated by password reset
        except Exception:
            return None, None
        return user_id, data.get("role")
    except Exception:
        pass
    return None, None

# ─── Database ────────────────────────────────────────────────────────────────

def get_db_connection():
    """Buat koneksi ke MySQL. Retry otomatis jika DB belum siap (startup race)."""
    for attempt in range(10):
        try:
            return mysql.connector.connect(
                host=os.environ.get("DB_HOST", "db"),
                port=int(os.environ.get("DB_PORT", 3306)),
                database=os.environ.get("DB_NAME", "speccheck"),
                user=os.environ.get("DB_USER", "speccheck"),
                password=os.environ.get("DB_PASSWORD", "Sp3cCh3ck@Db#2026!xK9mPqR7"),
                charset="utf8mb4",
                use_unicode=True,
                collation="utf8mb4_unicode_ci"
            )
        except mysql.connector.Error:
            if attempt < 9:
                print(f"  DB belum siap, retry {attempt+1}/10...")
                time.sleep(3)
            else:
                raise

def row_to_sw(r):
    """Konversi row DB ke dict software TANPA resolve (cepat, lazy)."""
    return {
        "id":   r["id"],
        "name": r["name"],
        "cat":  r["cat"],
        "icon": None,
        "min":  {"cpu": r["min_cpu"], "ram": r["min_ram"],
                 "vram": float(r["min_vram"]), "disk": r["min_disk"],
                 "gpu_score": vram_to_score(float(r["min_vram"]))},
        "rec":  {"cpu": r["rec_cpu"], "ram": r["rec_ram"],
                 "vram": float(r["rec_vram"]), "disk": r["rec_disk"],
                 "gpu_score": vram_to_score(float(r["rec_vram"]))},
        "url":             r.get("url"),
        "description":     r.get("description"),
        "cover_image_url": r.get("cover_image_url"),
        "raw": {
            "cpu_min": r.get("raw_cpu_min") or "",
            "gpu_min": r.get("raw_gpu_min") or "",
            "cpu_rec": r.get("raw_cpu_rec") or "",
            "gpu_rec": r.get("raw_gpu_rec") or "",
        }
    }

def fetch_all_software(limit=None, offset=0):
    """Ambil game dari MySQL. Ringan — tidak ada Python-side resolve."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    sql = "SELECT * FROM software WHERE cat = 'Game' AND url IS NOT NULL AND url != '' ORDER BY name"
    if limit:
        sql += f" LIMIT {int(limit)} OFFSET {int(offset)}"
    cursor.execute(sql)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [row_to_sw(r) for r in rows]

def fetch_software_by_search(query_str=None, limit=12):
    """Ambil game dari MySQL berdasarkan query pencarian (LIKE) dengan limit."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    if query_str:
        sql = """
            SELECT * FROM software 
            WHERE cat = 'Game' 
              AND url IS NOT NULL 
              AND url != '' 
              AND name LIKE %s
            ORDER BY name 
            LIMIT %s
        """
        cursor.execute(sql, (f"%{query_str}%", int(limit)))
    else:
        # Tampilkan game yang memiliki nama diawali huruf atau angka (menghindari symbol aneh seperti !)
        sql = """
            SELECT * FROM software 
            WHERE cat = 'Game' 
              AND url IS NOT NULL 
              AND url != '' 
              AND name REGEXP '^[a-zA-Z0-9]'
            ORDER BY name 
            LIMIT %s
        """
        cursor.execute(sql, (int(limit),))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [row_to_sw(r) for r in rows]

def fetch_software_paginated(query_str=None, letter=None):
    """Ambil game dari MySQL dengan pencarian dan filter huruf awalan."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    where_clauses = ["cat = 'Game'", "url IS NOT NULL", "url != ''"]
    params = []
    
    if query_str:
        where_clauses.append("name LIKE %s")
        params.append(f"%{query_str}%")
        
    if letter:
        if letter == "#":
            # Mulai dengan simbol (bukan huruf a-z dan bukan angka 0-9)
            where_clauses.append("name REGEXP '^[^a-zA-Z0-9]'")
        else:
            # Mulai dengan huruf tertentu
            where_clauses.append("name LIKE %s")
            params.append(f"{letter}%")
            
    where_sql = " AND ".join(where_clauses)
    
    data_sql = f"SELECT * FROM software WHERE {where_sql} ORDER BY name"
    cursor.execute(data_sql, tuple(params))
    rows = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return [row_to_sw(r) for r in rows]



def cleanup_database():
    """Hapus mock data lama (non-game dan game tanpa URL PCGamingWiki)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        deleted = cursor.execute(
            "DELETE FROM software WHERE cat != 'Game' OR url IS NULL OR url = ''"
        )
        conn.commit()
        print(f"[DATABASE] Membersihkan mock data selesai.")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[DATABASE] Gagal membersihkan mock data: {e}")

def init_db():
    """Inisialisasi tabel users (dengan kolom auth ganda) dan user_specs, serta seed admin."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NULL,
                email VARCHAR(255) UNIQUE NULL,
                google_id VARCHAR(255) UNIQUE NULL,
                auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
                email_verified BOOLEAN NOT NULL DEFAULT FALSE,
                token_version INT NOT NULL DEFAULT 0,
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        migration_cols = [
            ("email", "VARCHAR(255) UNIQUE NULL"),
            ("google_id", "VARCHAR(255) UNIQUE NULL"),
            ("auth_provider", "VARCHAR(20) NOT NULL DEFAULT 'local'"),
            ("email_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("token_version", "INT NOT NULL DEFAULT 0"),
            ("role", "VARCHAR(20) NOT NULL DEFAULT 'user'"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ]
        cursor.execute("SHOW COLUMNS FROM users")
        existing = [r[0] for r in cursor.fetchall()]
        for col_name, col_def in migration_cols:
            if col_name not in existing:
                try:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
                    print(f"[MIGRATION] Kolom '{col_name}' ditambahkan ke users.")
                except Exception:
                    pass
        
        # Ensure default values for existing users
        try:
            cursor.execute("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''")
            cursor.execute("UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL OR auth_provider = ''")
            conn.commit()
        except Exception:
            pass

        # Ubah password_hash jadi nullable jika belum
        try:
            cursor.execute("ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL")
        except Exception:
            pass

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_specs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNIQUE NOT NULL,
                cpu INT DEFAULT 0,
                ram INT DEFAULT 0,
                vram FLOAT DEFAULT 0,
                disk INT DEFAULT 0,
                cpu_name VARCHAR(150),
                gpu_name VARCHAR(150),
                os VARCHAR(100),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        # ── Tabel komentar game ──
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS game_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                game_id INT NOT NULL,
                user_id INT NOT NULL,
                content TEXT NOT NULL,
                parent_id INT NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES software(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES game_comments(id) ON DELETE CASCADE
            )
        """)
        # Migrate parent_id column if missing
        try:
            cursor.execute("SHOW COLUMNS FROM game_comments LIKE 'parent_id'")
            if not cursor.fetchone():
                cursor.execute("ALTER TABLE game_comments ADD COLUMN parent_id INT NULL DEFAULT NULL")
                cursor.execute("ALTER TABLE game_comments ADD FOREIGN KEY (parent_id) REFERENCES game_comments(id) ON DELETE CASCADE")
                print("[MIGRATION] Kolom 'parent_id' ditambahkan ke game_comments.")
        except Exception:
            pass
        # ── Tabel request game baru ──
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS game_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                game_name VARCHAR(200) NOT NULL,
                notes TEXT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        # ── Tabel request data lengkap untuk game yang sudah ada ──
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS game_data_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                game_id INT NOT NULL,
                user_id INT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_request (game_id, user_id),
                FOREIGN KEY (game_id) REFERENCES software(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        # Ensure status column in game_data_requests
        try:
            cursor.execute("SHOW COLUMNS FROM game_data_requests LIKE 'status'")
            if not cursor.fetchone():
                cursor.execute("ALTER TABLE game_data_requests ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'")
                print("[MIGRATION] Kolom 'status' ditambahkan ke game_data_requests.")
        except Exception:
            pass
        # ── Tabel view tracking untuk trending game ──
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS game_views (
                id INT AUTO_INCREMENT PRIMARY KEY,
                game_id INT NOT NULL,
                viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_game_viewed (game_id, viewed_at),
                FOREIGN KEY (game_id) REFERENCES software(id) ON DELETE CASCADE
            )
        """)
        # ── Migration Indexing untuk Performa VPS ──
        indexes_to_create = [
            ("software", "idx_sw_cat_url_name", "CREATE INDEX idx_sw_cat_url_name ON software (cat, url(100), name)"),
            ("software", "idx_sw_name", "CREATE INDEX idx_sw_name ON software (name)"),
            ("game_comments", "idx_gc_game_created", "CREATE INDEX idx_gc_game_created ON game_comments (game_id, created_at)"),
            ("password_reset_tokens", "idx_prt_hash_exp", "CREATE INDEX idx_prt_hash_exp ON password_reset_tokens (token_hash, used, expires_at)"),
            ("game_requests", "idx_gr_user_status", "CREATE INDEX idx_gr_user_status ON game_requests (user_id, status)")
        ]
        for tbl, idx_name, create_sql in indexes_to_create:
            try:
                cursor.execute(f"SHOW INDEX FROM {tbl} WHERE Key_name = '{idx_name}'")
                if not cursor.fetchone():
                    cursor.execute(create_sql)
                    print(f"[MIGRATION] Index '{idx_name}' dibuat pada tabel '{tbl}'.")
            except Exception:
                pass
        # Seed admin dari .env (tidak ada hardcoded credentials)
        seed_email = os.environ.get("SEED_ADMIN_EMAIL")
        seed_password = os.environ.get("SEED_ADMIN_PASSWORD")
        if seed_email and seed_password:
            cursor.execute("SELECT id FROM users WHERE username = %s OR email = %s", (seed_email, seed_email))
            if not cursor.fetchone():
                from werkzeug.security import generate_password_hash
                custom_admin_pass = generate_password_hash(seed_password)
                cursor.execute("""
                    INSERT INTO users (username, password_hash, email, role, auth_provider, email_verified) 
                    VALUES (%s, %s, %s, 'admin', 'local', TRUE)
                """, (seed_email, custom_admin_pass, seed_email))
                print(f"[DATABASE] Custom admin seeded ({seed_email}).")
        conn.commit()
        cursor.close()
        conn.close()
        print("[DATABASE] Inisialisasi tabel selesai.")
    except Exception as e:
        print(f"[DATABASE] Gagal menginisialisasi database: {e}")

# Jalankan init dan cleanup saat module dimuat
init_db()
cleanup_database()


# ─── Email Helper ────────────────────────────────────────────────────────────

def _send_reset_email(to_email: str, raw_token: str):
    """Kirim email link reset password via SMTP. Jika SMTP tidak dikonfigurasi, log ke console."""
    reset_url = f"{FRONTEND_URL}/reset-password?token={raw_token}"

    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    
    # Gmail SMTP requires the envelope sender to match the authenticated email account
    if "gmail.com" in smtp_host.lower():
        from_email = smtp_user
    else:
        from_email = os.environ.get("SMTP_FROM_EMAIL", smtp_user)

    html_body = f"""
    <html><body style="font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px;">
      <div style="max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
        <h2 style="color: #00d4ff; margin-bottom: 8px;">Bisa main nggak?</h2>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">Reset Password</p>
        <p>Kami menerima permintaan reset password untuk akun Anda.</p>
        <p>Klik tombol di bawah ini untuk membuat password baru. Link ini hanya berlaku selama <strong>1 jam</strong>.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{reset_url}" style="background: linear-gradient(135deg, #00d4ff, #7c3aed); color: #000; font-weight: 700; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">Reset Password →</a>
        </div>
        <p style="color: #64748b; font-size: 12px;">Jika Anda tidak meminta reset ini, abaikan email ini. Password Anda tidak akan berubah.</p>
      </div>
    </body></html>
    """

    if not smtp_host or not smtp_user or not smtp_password or smtp_user == "your_email@gmail.com":
        print(f"[RESET-EMAIL] SMTP belum dikonfigurasi di .env. Link reset untuk {to_email}:", flush=True)
        print(f"[RESET-EMAIL] {reset_url}", flush=True)
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Reset Password — Bisa main nggak?"
        msg["From"] = from_email
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        clean_password = smtp_password.replace(" ", "")

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()  # Mandatory after STARTTLS
            server.login(smtp_user, clean_password)
            server.sendmail(from_email, to_email, msg.as_string())
        print(f"[RESET-EMAIL] Email SUKSES dikirim via SMTP ke {to_email}", flush=True)
        print(f"[RESET-EMAIL] Link reset: {reset_url}", flush=True)
    except Exception as e:
        print(f"[RESET-EMAIL] GAGAL kirim email via SMTP ({e})", flush=True)
        print(f"[RESET-EMAIL] FALLBACK RESET LINK FOR {to_email}: {reset_url}", flush=True)



# ─── Analisis ────────────────────────────────────────────────────────────────

# Cache resolve results agar tidak compute ulang untuk game yang sama
_resolve_cache = {}

def resolve_cached(raw_cpu, raw_gpu):
    key = (raw_cpu, raw_gpu)
    if key not in _resolve_cache:
        _resolve_cache[key] = resolve_game_requirement(raw_cpu, raw_gpu)
    return _resolve_cache[key]

# ─── Simple TTL In-Memory Cache ──────────────────────────────────────────────
# Digunakan untuk analytics & trending agar tidak berat di setiap request
_ttl_cache = {}  # key -> (data, expire_timestamp)

def cache_get(key):
    """Ambil data dari cache jika belum expired."""
    entry = _ttl_cache.get(key)
    if entry and time.time() < entry[1]:
        return entry[0]
    _ttl_cache.pop(key, None)
    return None

def cache_set(key, data, ttl_seconds):
    """Simpan data ke cache dengan TTL."""
    _ttl_cache[key] = (data, time.time() + ttl_seconds)

def analyze_one(spec, sw, cpu_score, gpu_score):
    """Hitung grade game vs spesifikasi user. cpu_score & gpu_score sudah di-resolve sebelumnya."""
    # Resolve game requirements secara lazy (cached)
    raw = sw.get("raw", {})
    min_cpu_score, min_gpu_score = resolve_cached(raw.get("cpu_min", ""), raw.get("gpu_min", ""))
    rec_cpu_score, rec_gpu_score = resolve_cached(raw.get("cpu_rec", ""), raw.get("gpu_rec", ""))

    # Gabungkan dengan nilai numerik dari DB sebagai fallback (di-scale ke performance score)
    min_cpu = int(min_cpu_score) or mhz_to_score(sw["min"]["cpu"])
    min_gpu = float(min_gpu_score) or sw["min"]["gpu_score"]
    rec_cpu = int(rec_cpu_score) or mhz_to_score(sw["rec"]["cpu"])
    rec_gpu = float(rec_gpu_score) or sw["rec"]["gpu_score"]

    checks = [
        ("CPU",     cpu_score,    min_cpu,           rec_cpu),
        ("RAM",     spec["ram"],  sw["min"]["ram"],  sw["rec"]["ram"]),
        ("GPU",     gpu_score,    min_gpu,           rec_gpu),
        ("Storage", spec["disk"], sw["min"]["disk"], sw["rec"]["disk"]),
    ]
    total_score = 0
    details = []
    is_below_min = False
    critical_failure = False
    unknown_count = 0
    for label, user, mn, rec in checks:
        if mn == 0 and rec == 0:
            status, score, pct = "unknown", 25, 100
            unknown_count += 1
        elif (rec > 0 and user >= rec) or (rec == 0 and mn > 0 and user >= mn):
            status, score, pct = "optimal", 25, 100
        elif mn > 0 and user >= mn:
            score = 15
            if rec > mn:
                pct = 50 + ((user - mn) / (rec - mn)) * 50
            else:
                pct = 75
            status = "minimum"
        else:
            score = 0
            divisor = mn if mn > 0 else rec
            pct = (user / max(divisor, 1)) * 50
            status = "below"
            is_below_min = True
            if label == "Storage" or user == 0:
                critical_failure = True
        total_score += score
        details.append({"label": label, "user": user, "min": mn, "rec": rec,
                        "status": status, "pct": round(min(pct, 100))})

    if unknown_count == 4:
        total_score = -1
    elif critical_failure:
        total_score = min(total_score, 24)
    elif is_below_min:
        total_score = min(total_score, 49)

    if total_score == -1:   grade, lbl, color = "?", "Data Belum Tersedia", "#94a3b8"
    elif total_score >= 90: grade, lbl, color = "S", "Sangat Optimal",   "#22d3ee"
    elif total_score >= 70: grade, lbl, color = "A", "Direkomendasikan", "#4ade80"
    elif total_score >= 50: grade, lbl, color = "B", "Bisa (Minimum)",   "#fbbf24"
    elif total_score >= 25: grade, lbl, color = "C", "Di Bawah Minimum", "#fb923c"
    else:                   grade, lbl, color = "D", "Tidak Bisa",       "#f87171"
    return {"totalScore": total_score, "grade": grade, "label": lbl,
            "color": color, "details": details}

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "Bisa main nggak? Backend berjalan"})

@app.route("/api/db/clean-duplicates", methods=["GET", "POST"])
def clean_db_duplicates():
    auth_header = request.headers.get("Authorization")
    _, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get count before
        cursor.execute("SELECT COUNT(*) FROM software")
        count_before = cursor.fetchone()[0]
        
        # Run cleanup query
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
        cursor.execute("SELECT COUNT(*) FROM software")
        count_after = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        deleted = count_before - count_after
        return jsonify({
            "status": "success",
            "message": f"Berhasil menghapus {deleted} game duplikat.",
            "count_before": count_before,
            "count_after": count_after,
            "deleted": deleted
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500



# ─── Analytics Routes ─────────────────────────────────────────────────────────

@app.route("/api/game/<int:game_id>/view", methods=["POST"])
def track_game_view(game_id):
    """Catat satu kunjungan ke game. Fire-and-forget: selalu return cepat."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO game_views (game_id) VALUES (%s)", (game_id,))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception:
        pass  # Jangan sampai view tracking mengganggu user
    return jsonify({"ok": True}), 200


@app.route("/api/analytics/trending")
def analytics_trending():
    """Top 10 game terpopuler dalam 30 hari terakhir. Hasil di-cache 5 menit."""
    cached = cache_get("trending")
    if cached is not None:
        return jsonify(cached)

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT s.id, s.name, s.cover_image_url, COUNT(gv.id) AS view_count
            FROM game_views gv
            JOIN software s ON gv.game_id = s.id
            WHERE gv.viewed_at >= NOW() - INTERVAL 30 DAY
            GROUP BY s.id, s.name, s.cover_image_url
            ORDER BY view_count DESC
            LIMIT 10
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        result = {"trending": [
            {
                "id": r["id"],
                "name": r["name"],
                "cover_image_url": r["cover_image_url"],
                "view_count": int(r["view_count"])
            } for r in rows
        ]}
        cache_set("trending", result, 300)  # Cache 5 menit
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500




# ─── Auth Routes ─────────────────────────────────────────────────────────────
from werkzeug.security import generate_password_hash, check_password_hash



@app.route("/api/auth/register", methods=["POST"])
@limiter.limit("3/15 minutes")
def auth_register():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    email    = data.get("email", "").strip().lower()

    if not username or not password:
        return jsonify({"error": "Username dan password diperlukan"}), 400
    if not email:
        return jsonify({"error": "Email wajib diisi agar bisa reset password jika lupa"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password minimal 8 karakter"}), 400

    import re as _re
    if not _re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return jsonify({"error": "Format email tidak valid"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Cek duplikasi username
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({"error": "Username sudah terdaftar"}), 400
        # Cek duplikasi email
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({"error": "Email sudah terdaftar di akun lain"}), 400

        hashed = generate_password_hash(password)
        cursor.execute(
            "INSERT INTO users (username, password_hash, email, role, auth_provider, email_verified) VALUES (%s, %s, %s, 'user', 'local', FALSE)",
            (username, hashed, email)
        )
        conn.commit()
        user_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({
            "message": "Registrasi berhasil",
            "user": {"id": user_id, "username": username, "role": "user"}
        }), 201
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("5/15 minutes")
def auth_login():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    if not username or not password:
        return jsonify({"error": "Username/email dan password diperlukan"}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Support login by username OR email
        cursor.execute(
            "SELECT * FROM users WHERE username = %s OR email = %s",
            (username, username)
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user:
            return jsonify({"error": "Username/email atau password salah"}), 401
        
        # Akun Google tanpa password lokal
        if user["auth_provider"] == "google" and not user["password_hash"]:
            return jsonify({"error": "Akun ini terdaftar via Google. Gunakan tombol 'Login dengan Google'."}), 401
        
        if not user["password_hash"] or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Username atau password salah"}), 401
            
        token = generate_token(user["id"], user["role"], user.get("token_version", 0))
        return jsonify({
            "message": "Login berhasil",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "role": user["role"],
                "auth_provider": user["auth_provider"],
                "token": token
            }
        }), 200
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/auth/google", methods=["POST"])
@limiter.limit("10/15 minutes")
def auth_google():
    """Login/Register via Google ID Token."""
    data = request.json or {}
    id_token_str = data.get("id_token", "").strip()
    if not id_token_str:
        return jsonify({"error": "Google ID Token diperlukan"}), 400
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google OAuth belum dikonfigurasi di server"}), 500
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        idinfo = google_id_token.verify_oauth2_token(
            id_token_str, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        google_sub = idinfo.get("sub")
        email = idinfo.get("email", "")
        email_verified = idinfo.get("email_verified", False)
        name = idinfo.get("name", "")
        if not google_sub:
            return jsonify({"error": "Token Google tidak valid"}), 401

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah google_id sudah terdaftar
        cursor.execute("SELECT * FROM users WHERE google_id = %s", (google_sub,))
        user = cursor.fetchone()
        
        if user:
            # Login existing Google user
            token = generate_token(user["id"], user["role"], user.get("token_version", 0))
            cursor.close()
            conn.close()
            return jsonify({
                "message": "Login Google berhasil",
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "role": user["role"],
                    "auth_provider": "google",
                    "token": token
                }
            }), 200
        else:
            # Register baru via Google — generate username dari email
            base_username = email.split("@")[0] if email else name.replace(" ", "").lower()
            base_username = base_username[:40]  # Batas agar muat di VARCHAR(50)
            username = base_username
            # Cek duplikat username, tambah suffix acak jika perlu
            for _ in range(10):
                cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
                if not cursor.fetchone():
                    break
                suffix = ''.join(random.choices(string.digits, k=4))
                username = f"{base_username[:45]}_{suffix}"
            
            cursor.execute("""
                INSERT INTO users (username, password_hash, email, google_id, auth_provider, email_verified, role)
                VALUES (%s, NULL, %s, %s, 'google', %s, 'user')
            """, (username, email or None, google_sub, email_verified))
            conn.commit()
            user_id = cursor.lastrowid
            token = generate_token(user_id, "user", 0)
            cursor.close()
            conn.close()
            return jsonify({
                "message": "Registrasi Google berhasil",
                "user": {
                    "id": user_id,
                    "username": username,
                    "role": "user",
                    "auth_provider": "google",
                    "token": token
                }
            }), 201
    except ValueError as e:
        return jsonify({"error": f"Token Google tidak valid: {e}"}), 401
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/auth/check-provider")
def auth_check_provider():
    """Cek apakah akun punya email (untuk menampilkan/sembunyikan forgot password)."""
    username = request.args.get("username", "").strip()
    if not username:
        return jsonify({"has_email": False})
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT auth_provider, email FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        # Jangan ungkapkan apakah username ada — hanya kembalikan flag
        if user and user["auth_provider"] == "google" and user["email"]:
            return jsonify({"has_email": True})
        return jsonify({"has_email": False})
    except Exception:
        return jsonify({"has_email": False})

@app.route("/api/auth/forgot-password", methods=["POST"])
@limiter.limit("10/hour")
def auth_forgot_password():
    """Kirim link reset password. Mendukung akun Google DAN akun lokal (username/password)."""
    data = request.json or {}
    identifier = data.get("email", data.get("username", "")).strip()
    # Respons generik untuk semua kasus (anti-enumeration)
    generic_msg = "Jika akun terdaftar dan memiliki email, link reset telah dikirim ke email Anda."
    if not identifier:
        return jsonify({"message": generic_msg}), 200
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, email, auth_provider FROM users WHERE email = %s OR username = %s",
            (identifier, identifier)
        )
        user = cursor.fetchone()
        # Kirim reset jika: user punya email (berlaku untuk Google dan local yang punya email)
        if user and user.get("email"):
            # Generate reset token
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            cursor.execute("""
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                VALUES (%s, %s, DATE_ADD(NOW(), INTERVAL 1 HOUR))
            """, (user["id"], token_hash))
            conn.commit()
            # Kirim email
            _send_reset_email(user["email"], raw_token)
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[FORGOT-PW] Error: {e}", flush=True)
    return jsonify({"message": generic_msg}), 200

@app.route("/api/auth/reset-password", methods=["POST"])
def auth_reset_password():
    """Reset password menggunakan token dari email."""
    data = request.json or {}
    raw_token = data.get("token", "").strip()
    new_password = data.get("new_password", "").strip()
    generic_error = "Token tidak valid atau sudah kedaluwarsa."
    if not raw_token or not new_password:
        return jsonify({"error": generic_error}), 400
    if len(new_password) < 8:
        return jsonify({"error": "Password minimal 8 karakter"}), 400
    try:
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT * FROM password_reset_tokens
            WHERE token_hash = %s AND used = FALSE AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
        """, (token_hash,))
        token_row = cursor.fetchone()
        if not token_row:
            cursor.close()
            conn.close()
            return jsonify({"error": generic_error}), 400
        
        user_id = token_row["user_id"]
        hashed = generate_password_hash(new_password)
        # Update password DAN increment token_version (invalidasi semua sesi lama)
        cursor.execute("""
            UPDATE users SET password_hash = %s, token_version = token_version + 1
            WHERE id = %s
        """, (hashed, user_id))
        # Tandai token sudah dipakai
        cursor.execute("UPDATE password_reset_tokens SET used = TRUE WHERE id = %s", (token_row["id"],))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Password berhasil direset. Silakan login dengan password baru."}), 200
    except Exception as e:
        return jsonify({"error": generic_error}), 400


# ─── User Spec Routes ─────────────────────────────────────────────────────────

@app.route("/api/user/spec", methods=["GET", "POST", "DELETE"])
def user_spec():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id, role = verify_token(auth_header)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        if request.method == "POST":
            data = request.json or {}
            cpu = int(data.get("cpu", 0))
            ram = int(data.get("ram", 0))
            vram = float(data.get("vram", 0.0))
            disk = int(data.get("disk", 0))
            cpu_name = data.get("cpuName", "Unknown CPU")
            gpu_name = data.get("gpuName", "Unknown GPU")
            os_name = data.get("os", "Unknown OS")
            
            # Upsert
            cursor.execute("SELECT id FROM user_specs WHERE user_id = %s", (user_id,))
            exists = cursor.fetchone()
            if exists:
                cursor.execute("""
                    UPDATE user_specs 
                    SET cpu=%s, ram=%s, vram=%s, disk=%s, cpu_name=%s, gpu_name=%s, os=%s 
                    WHERE user_id=%s
                """, (cpu, ram, vram, disk, cpu_name, gpu_name, os_name, user_id))
            else:
                cursor.execute("""
                    INSERT INTO user_specs (user_id, cpu, ram, vram, disk, cpu_name, gpu_name, os) 
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (user_id, cpu, ram, vram, disk, cpu_name, gpu_name, os_name))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({"message": "Spesifikasi berhasil disimpan"}), 200
            
        elif request.method == "DELETE":
            cursor.execute("DELETE FROM user_specs WHERE user_id = %s", (user_id,))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({"message": "Spesifikasi berhasil dihapus"}), 200
            
        else: # GET
            cursor.execute("SELECT * FROM user_specs WHERE user_id = %s", (user_id,))
            row = cursor.fetchone()
            cursor.close()
            conn.close()
            if not row:
                return jsonify({"spec": None}), 200
            return jsonify({
                "spec": {
                    "cpu": row["cpu"],
                    "ram": row["ram"],
                    "vram": row["vram"],
                    "disk": row["disk"],
                    "cpuName": row["cpu_name"],
                    "gpuName": row["gpu_name"],
                    "os": row["os"]
                }
            }), 200
            
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500


@app.route("/api/user/profile", methods=["GET"])
def user_profile():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id, role = verify_token(auth_header)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT username, email, auth_provider, email_verified, created_at, password_hash
            FROM users WHERE id = %s
        """, (user_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not row:
            return jsonify({"error": "User tidak ditemukan"}), 404
            
        has_password = row["password_hash"] is not None
        
        return jsonify({
            "username": row["username"],
            "email": row["email"],
            "auth_provider": row["auth_provider"],
            "email_verified": bool(row["email_verified"]),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "has_password": has_password
        }), 200
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500


@app.route("/api/user/change-password", methods=["POST"])
@limiter.limit("5 per 15 minutes")
def user_change_password():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id, role = verify_token(auth_header)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json or {}
    current_password = data.get("current_password", "").strip()
    new_password = data.get("new_password", "").strip()
    
    if not new_password or len(new_password) < 8:
        return jsonify({"error": "Password baru minimal 8 karakter"}), 400
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT password_hash, token_version FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({"error": "User tidak ditemukan"}), 404
            
        # Jika user sudah punya password_hash, wajibkan password lama
        if user["password_hash"] is not None:
            if not current_password:
                cursor.close()
                conn.close()
                return jsonify({"error": "Password lama wajib diisi"}), 400
            if not check_password_hash(user["password_hash"], current_password):
                cursor.close()
                conn.close()
                return jsonify({"error": "Password lama tidak cocok"}), 400
                
        # Hash password baru dan naikkan token version (invalidasi semua sesi lama)
        new_hashed = generate_password_hash(new_password)
        new_token_version = user["token_version"] + 1
        
        cursor.execute("""
            UPDATE users SET password_hash = %s, token_version = %s
            WHERE id = %s
        """, (new_hashed, new_token_version, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        
        # Re-issue token untuk device ini sendiri agar tidak ikut ter-logout
        new_token = generate_token(user_id, role, new_token_version)
        
        return jsonify({
            "message": "Password berhasil diperbarui",
            "token": new_token
        }), 200
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500


# ─── Admin Routes ─────────────────────────────────────────────────────────────

@app.route("/api/admin/games")
def admin_all_games():
    """Mengembalikan daftar semua game (lengkap maupun belum) untuk dikelola admin."""
    auth_header = request.headers.get("Authorization")
    user_id, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403
        
    search = request.args.get("q", "").strip()
    status_filter = request.args.get("filter", "all")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT id, name, cover_image_url, url,
                   min_cpu, min_ram, min_vram, min_disk,
                   rec_cpu, rec_ram, rec_vram, rec_disk
            FROM software 
            WHERE cat = 'Game'
        """
        params = []
        if search:
            query += " AND name LIKE %s"
            params.append(f"%{search}%")
            
        if status_filter == "incomplete":
            query += " AND (min_cpu = 0 OR min_ram = 0 OR min_vram = 0 OR min_disk = 0 OR rec_cpu = 0 OR rec_ram = 0 OR rec_vram = 0 OR rec_disk = 0)"
        elif status_filter == "complete":
            query += " AND min_cpu > 0 AND min_ram > 0 AND min_vram > 0 AND min_disk > 0 AND rec_cpu > 0 AND rec_ram > 0 AND rec_vram > 0 AND rec_disk > 0"
            
        query += " ORDER BY name LIMIT 1000"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({"games": rows})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/admin/games-incomplete")
def admin_games_incomplete():
    auth_header = request.headers.get("Authorization")
    user_id, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Ambil game yang memiliki minimal 1 parameter spesifikasi (min/rec) yang belum diisi (bernilai 0)
        cursor.execute("""
            SELECT id, name, cover_image_url, url,
                   min_cpu, min_ram, min_vram, min_disk,
                   rec_cpu, rec_ram, rec_vram, rec_disk
            FROM software 
            WHERE cat = 'Game' AND (min_cpu = 0 OR min_ram = 0 OR min_vram = 0 OR min_disk = 0 OR rec_cpu = 0 OR rec_ram = 0 OR rec_vram = 0 OR rec_disk = 0)
            ORDER BY name
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({"games": rows})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/admin/users")
def admin_users():
    auth_header = request.headers.get("Authorization")
    user_id, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Ambil semua user beserta speknya
        cursor.execute("""
            SELECT u.id, u.username, u.email, u.auth_provider, u.role, u.created_at, 
                   s.cpu, s.ram, s.vram, s.disk, s.cpu_name, s.gpu_name, s.os 
            FROM users u 
            LEFT JOIN user_specs s ON u.id = s.user_id 
            ORDER BY u.created_at DESC
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Format output
        users_list = []
        for r in rows:
            spec = None
            if r["cpu_name"] or r["gpu_name"]:
                spec = {
                    "cpu": r["cpu"],
                    "ram": r["ram"],
                    "vram": r["vram"],
                    "disk": r["disk"],
                    "cpuName": r["cpu_name"],
                    "gpuName": r["gpu_name"],
                    "os": r["os"]
                }
            users_list.append({
                "id": r["id"],
                "username": r["username"],
                "email": r["email"] if r.get("email") else "-",
                "auth_provider": r["auth_provider"] if r.get("auth_provider") else "local",
                "role": r["role"] if r.get("role") else "user",
                "created_at": r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if r["created_at"] else None,
                "spec": spec
            })
        return jsonify({"users": users_list})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
def admin_update_user(user_id):
    """Admin dapat mengupdate email user."""
    auth_header = request.headers.get("Authorization")
    _, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    data = request.json or {}
    new_email = data.get("email", "").strip()
    if not new_email:
        return jsonify({"error": "Email tidak boleh kosong"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Cek apakah email sudah dipakai user lain
        cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (new_email, user_id))
        if cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({"error": "Email sudah digunakan oleh akun lain"}), 400

        cursor.execute("UPDATE users SET email = %s WHERE id = %s", (new_email, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Email user berhasil diperbarui"})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Gagal memperbarui email user"}), 500

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def admin_delete_user(user_id):
    """Admin hapus user (tidak bisa hapus diri sendiri)."""
    auth_header = request.headers.get("Authorization")
    current_user_id, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403
    if current_user_id == user_id:
        return jsonify({"error": "Tidak bisa menghapus akun sendiri"}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Clean up related records explicitly to avoid FK constraint failures on old DB schemas
        for table in ["user_specs", "game_comments", "game_requests", "game_data_requests", "password_reset_tokens"]:
            try:
                cursor.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
            except Exception:
                pass
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "User berhasil dihapus"})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": f"Gagal menghapus user: {str(e)}"}), 500

@app.route("/api/hardware/resolve-spec", methods=["POST"])
@limiter.limit("60/minute")
def api_resolve_hardware_spec():
    """Mengubah nama CPU dan GPU menjadi skor MHz & VRAM secara otomatis."""
    data = request.json or {}
    cpu_name = str(data.get("cpu_name", "")).strip()
    gpu_name = str(data.get("gpu_name", "")).strip()

    cpu_score, matched_cpu = match_cpu(cpu_name) if cpu_name else (0, "")
    gpu_score, matched_gpu = match_gpu(gpu_name) if gpu_name else (0, "")
    vram = extract_vram_from_name(gpu_name) if gpu_name else 0.0

    return jsonify({
        "cpu_name": matched_cpu or cpu_name,
        "cpu_score": cpu_score,
        "gpu_name": matched_gpu or gpu_name,
        "gpu_score": gpu_score,
        "vram": vram
    })

@app.route("/api/hardware/options")
@limiter.limit("60/minute")
def api_hardware_options():
    """Mengembalikan daftar nama CPU dan GPU dari database internal. Di-cache 1 jam."""
    cached = cache_get("hw_options")
    if cached is not None:
        return jsonify(cached)
    try:
        cpus = get_cpus() or []
        gpus = get_gpus() or []
        cpu_names = sorted(list(set(c["name"] for c in cpus if "name" in c)))[:300]
        gpu_names = sorted(list(set(g["name"] for g in gpus if "name" in g)))[:300]
        res = {"cpus": cpu_names, "gpus": gpu_names}
        cache_set("hw_options", res, 3600)  # Cache 1 jam
        return jsonify(res)
    except Exception as e:
        return jsonify({"cpus": [], "gpus": []})

@app.route("/api/admin/games/<int:game_id>", methods=["PUT"])
def admin_update_game(game_id):
    """Admin update spesifikasi game yang belum lengkap (mendukung nilai numerik & model name)."""
    auth_header = request.headers.get("Authorization")
    _, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    data = request.json or {}

    # Konversi otomatis dari model CPU/GPU jika nilai numerik belum diisi
    if data.get("min_cpu_name") and not data.get("min_cpu"):
        score, _ = match_cpu(data["min_cpu_name"])
        if score: data["min_cpu"] = score

    if data.get("rec_cpu_name") and not data.get("rec_cpu"):
        score, _ = match_cpu(data["rec_cpu_name"])
        if score: data["rec_cpu"] = score

    if data.get("min_gpu_name") and not data.get("min_vram"):
        vram = extract_vram_from_name(data["min_gpu_name"])
        if vram: data["min_vram"] = vram

    if data.get("rec_gpu_name") and not data.get("rec_vram"):
        vram = extract_vram_from_name(data["rec_gpu_name"])
        if vram: data["rec_vram"] = vram

    fields = ["min_cpu", "min_ram", "min_vram", "min_disk", "rec_cpu", "rec_ram", "rec_vram", "rec_disk"]
    updates = {f: data[f] for f in fields if f in data and data[f] is not None}
    if not updates:
        return jsonify({"error": "Tidak ada data yang diperbarui"}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [game_id]
        cursor.execute(f"UPDATE software SET {set_clause} WHERE id = %s", values)
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Spesifikasi game berhasil diperbarui"})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Gagal memperbarui game"}), 500

@app.route("/api/admin/requests/<req_type>/<path:game_name>", methods=["DELETE"])
def admin_delete_request(req_type, game_name):
    """Admin tandai request sebagai selesai (update status ke 'completed')."""
    auth_header = request.headers.get("Authorization")
    _, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if req_type == "new_game":
            cursor.execute("UPDATE game_requests SET status = 'completed' WHERE game_name = %s", (game_name,))
        elif req_type == "data":
            cursor.execute("""
                UPDATE game_data_requests dr
                JOIN software s ON dr.game_id = s.id
                SET dr.status = 'completed'
                WHERE s.name = %s
            """, (game_name,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Request berhasil ditandai selesai"})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Gagal memperbarui status request"}), 500


# ─── Game Comments Routes ────────────────────────────────────────────────────

@app.route("/api/game/<int:game_id>/comments")
def get_game_comments(game_id):
    """Ambil daftar komentar untuk sebuah game (publik)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Fetch all top-level comments
        cursor.execute("""
            SELECT c.id, c.content, c.created_at, c.user_id, c.parent_id,
                   u.username
            FROM game_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.game_id = %s AND c.parent_id IS NULL
            ORDER BY c.created_at ASC
            LIMIT 100
        """, (game_id,))
        comments = cursor.fetchall()
        # Fetch all replies
        cursor.execute("""
            SELECT c.id, c.content, c.created_at, c.user_id, c.parent_id,
                   u.username
            FROM game_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.game_id = %s AND c.parent_id IS NOT NULL
            ORDER BY c.created_at ASC
        """, (game_id,))
        replies = cursor.fetchall()
        cursor.close()
        conn.close()
        # Format dates and nest replies under parents
        reply_map = {}
        for r in replies:
            if r["created_at"]:
                r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            pid = r["parent_id"]
            if pid not in reply_map:
                reply_map[pid] = []
            reply_map[pid].append(r)
        for c in comments:
            if c["created_at"]:
                c["created_at"] = c["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            c["replies"] = reply_map.get(c["id"], [])
        return jsonify({"comments": comments})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/game/<int:game_id>/comments", methods=["POST"])
def post_game_comment(game_id):
    """Kirim komentar baru (wajib login)."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    user_id, role = verify_token(auth_header)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    content = str(data.get("content", ""))[:500].strip()
    parent_id = data.get("parent_id", None)
    if not content:
        return jsonify({"error": "Komentar tidak boleh kosong"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO game_comments (game_id, user_id, content, parent_id) VALUES (%s, %s, %s, %s)",
            (game_id, user_id, content, parent_id)
        )
        conn.commit()
        comment_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({"message": "Komentar berhasil dikirim", "id": comment_id}), 201
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/game/<int:game_id>/comments/<int:comment_id>", methods=["DELETE"])
def delete_game_comment(game_id, comment_id):
    """Hapus komentar (pemilik atau admin)."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    user_id, role = verify_token(auth_header)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT user_id FROM game_comments WHERE id = %s AND game_id = %s", (comment_id, game_id))
        comment = cursor.fetchone()
        if not comment:
            cursor.close()
            conn.close()
            return jsonify({"error": "Komentar tidak ditemukan"}), 404

        # Hanya pemilik komentar atau admin yang bisa hapus
        if comment["user_id"] != user_id and role != "admin":
            cursor.close()
            conn.close()
            return jsonify({"error": "Forbidden"}), 403

        cursor.execute("DELETE FROM game_comments WHERE id = %s", (comment_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Komentar berhasil dihapus"})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

# ─── Game Request Routes (Request Game Baru) ─────────────────────────────────

@app.route("/api/game-requests", methods=["POST"])
def create_game_request():
    """User request game baru yang belum ada di database."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    user_id, role = verify_token(auth_header)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    game_name = str(data.get("game_name", ""))[:200].strip()
    notes = str(data.get("notes", ""))[:500].strip()
    if not game_name:
        return jsonify({"error": "Nama game wajib diisi"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO game_requests (user_id, game_name, notes) VALUES (%s, %s, %s)",
            (user_id, game_name, notes or None)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Request game berhasil dikirim"}), 201
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/game-requests/mine")
def get_my_game_requests():
    """Ambil daftar request game (baru & data) milik user yang login."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    user_id, role = verify_token(auth_header)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Ambil request game baru
        cursor.execute("""
            SELECT id, game_name, notes, status, created_at, 'new_game' as req_type
            FROM game_requests
            WHERE user_id = %s
        """, (user_id,))
        reqs1 = cursor.fetchall() or []

        # Ambil request data lengkap
        cursor.execute("""
            SELECT dr.id, s.name as game_name, 'Request kelengkapan data spesifikasi' as notes, dr.status, dr.created_at, 'data' as req_type
            FROM game_data_requests dr
            JOIN software s ON dr.game_id = s.id
            WHERE dr.user_id = %s
        """, (user_id,))
        reqs2 = cursor.fetchall() or []

        cursor.close()
        conn.close()

        all_reqs = reqs1 + reqs2
        all_reqs.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

        for r in all_reqs:
            if r["created_at"]:
                r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M:%S")

        return jsonify({"requests": all_reqs})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

# ─── Game Data Request Routes (Request Data Lengkap) ─────────────────────────

@app.route("/api/game/<int:game_id>/request-data", methods=["POST"])
def request_game_data(game_id):
    """User request agar data spesifikasi game dilengkapi."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "Unauthorized"}), 401
    user_id, role = verify_token(auth_header)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Cek apakah user sudah pernah request game ini
        cursor.execute(
            "SELECT id FROM game_data_requests WHERE game_id = %s AND user_id = %s",
            (game_id, user_id)
        )
        if cursor.fetchone():
            # Sudah pernah request, return jumlah total
            cursor.execute(
                "SELECT COUNT(*) as cnt FROM game_data_requests WHERE game_id = %s",
                (game_id,)
            )
            count = cursor.fetchone()["cnt"]
            cursor.close()
            conn.close()
            return jsonify({"message": "Kamu sudah request data game ini", "already": True, "count": count})

        # Insert request baru
        cursor.execute(
            "INSERT INTO game_data_requests (game_id, user_id) VALUES (%s, %s)",
            (game_id, user_id)
        )
        conn.commit()

        # Return jumlah total request
        cursor.execute(
            "SELECT COUNT(*) as cnt FROM game_data_requests WHERE game_id = %s",
            (game_id,)
        )
        count = cursor.fetchone()["cnt"]
        cursor.close()
        conn.close()
        return jsonify({"message": "Request berhasil dikirim", "already": False, "count": count}), 201
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/game/<int:game_id>/request-data/count")
def get_game_data_request_count(game_id):
    """Ambil jumlah request data untuk sebuah game (publik)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT COUNT(*) as cnt FROM game_data_requests WHERE game_id = %s",
            (game_id,)
        )
        count = cursor.fetchone()["cnt"]

        # Cek apakah user yang login sudah request
        already = False
        auth_header = request.headers.get("Authorization")
        if auth_header:
            uid, _ = verify_token(auth_header)
            if uid:
                cursor.execute(
                    "SELECT id FROM game_data_requests WHERE game_id = %s AND user_id = %s",
                    (game_id, uid)
                )
                already = cursor.fetchone() is not None

        cursor.close()
        conn.close()
        return jsonify({"count": count, "already": already})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

# ─── Admin: Request Overview ─────────────────────────────────────────────────

@app.route("/api/admin/requests")
def admin_requests():
    """Admin lihat daftar request game (tanpa info user)."""
    auth_header = request.headers.get("Authorization")
    _, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Request game baru (hanya status pending)
        cursor.execute("""
            SELECT game_name, COUNT(*) as request_count
            FROM game_requests
            WHERE status = 'pending'
            GROUP BY game_name
            ORDER BY request_count DESC
            LIMIT 100
        """)
        new_game_requests = cursor.fetchall() or []

        # Request data lengkap (hanya status pending)
        cursor.execute("""
            SELECT s.name as game_name, COUNT(dr.id) as request_count
            FROM game_data_requests dr
            JOIN software s ON dr.game_id = s.id
            WHERE dr.status = 'pending'
            GROUP BY s.id, s.name
            ORDER BY request_count DESC
            LIMIT 100
        """)
        data_requests = cursor.fetchall() or []

        cursor.close()
        conn.close()
        return jsonify({
            "new_game_requests": new_game_requests,
            "data_requests": data_requests
        })
    except Exception as e:
        app.logger.error(f"Error in admin_requests: {e}")
        return jsonify({
            "new_game_requests": [],
            "data_requests": []
        }), 200


@app.route("/api/software")
def get_software():
    return jsonify(fetch_all_software())

@app.route("/api/software/count")
def get_software_count():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM software WHERE cat = 'Game' AND url IS NOT NULL AND url != ''")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return jsonify({"count": count})
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/software/featured")
def get_featured_software():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        names = ['Grand Theft Auto V', 'Cyberpunk 2077', 'Elden Ring', 'Red Dead Redemption 2', 'The Witcher 3: Wild Hunt']
        format_strings = ','.join(['%s'] * len(names))
        cursor.execute(f"""
            SELECT * FROM software 
            WHERE cat = 'Game' 
              AND url IS NOT NULL 
              AND url != '' 
              AND name IN ({format_strings})
            LIMIT 3
        """, names)
        rows = cursor.fetchall()
        
        if len(rows) < 3:
            needed = 3 - len(rows)
            exclude_ids = [r['id'] for r in rows]
            if exclude_ids:
                format_excludes = ','.join(['%s'] * len(exclude_ids))
                cursor.execute(f"""
                    SELECT * FROM software 
                    WHERE cat = 'Game' 
                      AND url IS NOT NULL 
                      AND url != '' 
                      AND id NOT IN ({format_excludes})
                    LIMIT {needed}
                """, tuple(exclude_ids))
            else:
                cursor.execute(f"""
                    SELECT * FROM software 
                    WHERE cat = 'Game' 
                      AND url IS NOT NULL 
                      AND url != '' 
                    LIMIT 3
                """)
            rows.extend(cursor.fetchall())
            
        cursor.close()
        conn.close()
        return jsonify([row_to_sw(r) for r in rows])
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

@app.route("/api/software/<int:game_id>")
def get_software_detail(game_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM software WHERE id = %s", (game_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            return jsonify({"error": "Game tidak ditemukan"}), 404
        
        sw = row_to_sw(row)
        
        # Jika spec dikirim via query parameters, jalankan perbandingan
        cpu_name = request.args.get("cpuName")
        gpu_name = request.args.get("gpuName")
        if cpu_name or gpu_name:
            spec = {
                "cpu": int(request.args.get("cpu", 0)),
                "ram": int(request.args.get("ram", 0)),
                "vram": float(request.args.get("vram", 0)),
                "disk": int(request.args.get("disk", 0)),
                "cpuName": cpu_name or "",
                "gpuName": gpu_name or ""
            }
            cpu_score, _ = match_cpu(spec["cpuName"], spec["cpu"])
            gpu_score, _ = match_gpu(spec["gpuName"], spec["vram"])
            sw["result"] = analyze_one(spec, sw, cpu_score, gpu_score)
            
        return jsonify(sw)
    except Exception as e:
        app.logger.error(f"Internal error: {e}")
        return jsonify({"error": "Terjadi kesalahan pada server. Silakan coba lagi."}), 500

def fetch_popular_games():
    """Ambil game populer dari MySQL. Jika kurang dari 30, ambil game acak/pertama untuk mengisi slot."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Daftar game populer yang representatif
        names = [
            "Grand Theft Auto V", "Cyberpunk 2077", "Elden Ring", "Red Dead Redemption 2", 
            "The Witcher 3: Wild Hunt", "Hogwarts Legacy", "Valorant", "Minecraft", 
            "Counter-Strike 2", "Apex Legends", "Dota 2", "Forza Horizon 5", 
            "Genshin Impact", "Baldur's Gate 3", "Marvel's Spider-Man Remastered", 
            "Resident Evil 4", "Hades", "Monster Hunter: World", "God of War", 
            "Stardew Valley", "Terraria", "Assassin's Creed Valhalla", "Call of Duty: Warzone"
        ]
        format_strings = ','.join(['%s'] * len(names))
        cursor.execute(f"""
            SELECT * FROM software 
            WHERE cat = 'Game' 
              AND url IS NOT NULL 
              AND url != '' 
              AND name IN ({format_strings})
        """, names)
        rows = cursor.fetchall()
        
        # Jika kurang dari 30 game ditemukan, isi sisa dengan game teratas dari database
        if len(rows) < 30:
            needed = 30 - len(rows)
            exclude_ids = [r['id'] for r in rows]
            if exclude_ids:
                format_excludes = ','.join(['%s'] * len(exclude_ids))
                cursor.execute(f"""
                    SELECT * FROM software 
                    WHERE cat = 'Game' 
                      AND url IS NOT NULL 
                      AND url != '' 
                      AND id NOT IN ({format_excludes})
                    LIMIT {needed}
                """, tuple(exclude_ids))
            else:
                cursor.execute(f"""
                    SELECT * FROM software 
                    WHERE cat = 'Game' 
                      AND url IS NOT NULL 
                      AND url != '' 
                    LIMIT 30
                """)
            rows.extend(cursor.fetchall())
            
        cursor.close()
        conn.close()
        return [row_to_sw(r) for r in rows]
    except Exception as e:
        print(f"[ERROR] Gagal fetch popular games: {e}")
        return []

@app.route("/api/hardware")
def get_hardware():
    """Return the CPU and GPU database for the Hardware Hierarchy page."""
    return jsonify({"cpus": get_cpus(), "gpus": get_gpus()})

@app.route("/api/analyze", methods=["POST"])
@limiter.limit("20 per minute")
def analyze():
    data = request.json or {}
    spec = {
        "cpu":     int(data.get("cpu", 0)),
        "ram":     int(data.get("ram", 0)),
        "vram":    float(data.get("vram", 0)),
        "disk":    int(data.get("disk", 0)),
        "cpuName": str(data.get("cpuName", ""))[:100].strip(),
        "gpuName": str(data.get("gpuName", ""))[:100].strip(),
    }
    search_query = str(data.get("q", ""))[:100].strip()
    
    page = max(1, int(data.get("page", 1)))
    limit = max(1, min(100, int(data.get("limit", 30))))
    letter = data.get("letter", None)
    if letter:
        letter = str(letter).strip()
        if not letter or len(letter) > 1:
            letter = None

    # Default to 'A' if browsing with empty query and empty letter to prevent huge dataset load
    if not search_query and not letter:
        letter = "A"

    only_runnable = bool(data.get("onlyRunnable", False))

    # Resolve user CPU/GPU SEKALI untuk semua game (bukan per-game)
    cpu_score, _ = match_cpu(spec["cpuName"], spec["cpu"])
    gpu_score, _ = match_gpu(spec["gpuName"], spec["vram"])

    # Fetch matching software list
    software_db = fetch_software_paginated(search_query, letter)
    
    # Calculate compat grades
    analyzed = [{**sw, "result": analyze_one(spec, sw, cpu_score, gpu_score)} for sw in software_db]
    
    # Filter only runnable if requested
    if only_runnable and spec["cpu"] > 0:
        analyzed = [r for r in analyzed if r["result"]["grade"] in ["S", "A", "B", "C"]]
        
    total_items = len(analyzed)
    
    # Paginate analyzed list in Python
    offset = (page - 1) * limit
    paginated_results = analyzed[offset : offset + limit]
    
    import math
    total_pages = math.ceil(total_items / limit) if total_items > 0 else 0
    
    stats = {
        "canRun":  sum(1 for r in analyzed if r["result"]["totalScore"] >= 50),
        "optimal": sum(1 for r in analyzed if r["result"]["totalScore"] >= 90),
        "cantRun": sum(1 for r in analyzed if r["result"]["totalScore"] < 25),
        "gamesOk": sum(1 for r in analyzed if r["cat"] == "Game" and r["result"]["totalScore"] >= 70),
        "total":   total_items,
    }

    # Dapatkan 10 game populer yang bisa dijalankan komputernya
    popular_db = fetch_popular_games()
    popular_analyzed = [{**sw, "result": analyze_one(spec, sw, cpu_score, gpu_score)} for sw in popular_db]
    popular_runnable = [r for r in popular_analyzed if r["result"]["totalScore"] >= 50]
    popular_runnable = popular_runnable[:10]

    return jsonify({
        "results": paginated_results, 
        "stats": stats, 
        "popularRunnable": popular_runnable,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages
        }
    })

@app.route("/api/image-proxy")
def image_proxy():
    """Proxy gambar dari PCGamingWiki untuk bypass hotlinking protection. Dengan in-memory cache 24 jam."""
    url = request.args.get("url", "")
    if not url:
        return jsonify({"error": "URL diperlukan"}), 400

    from urllib.parse import urlparse
    try:
        parsed_url = urlparse(url)
        if parsed_url.scheme not in ["http", "https"]:
            return jsonify({"error": "Skema URL tidak valid"}), 400

        hostname = parsed_url.hostname
        if not hostname:
            return jsonify({"error": "Domain tidak valid"}), 400

        allowed_domains = ["pcgamingwiki.com", "thumbnails.pcgamingwiki.com", "images.pcgamingwiki.com"]
        is_allowed = any(hostname == d or hostname.endswith("." + d) for d in allowed_domains)
        if not is_allowed:
            return jsonify({"error": "Domain tidak diizinkan"}), 403

        now = time.time()

        # Cek cache yang masih valid
        cached = _IMAGE_CACHE.get(url)
        if cached and cached["expires"] > now:
            return Response(
                cached["data"],
                content_type=cached["content_type"],
                headers={"Cache-Control": "public, max-age=86400", "X-Cache": "HIT"}
            )

        # Fetch dari PCGamingWiki dengan timeout pendek (5 detik)
        try:
            resp = req_lib.get(url, timeout=5, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.pcgamingwiki.com/",
            })
            if resp.status_code == 200:
                content_type = resp.headers.get("Content-Type", "image/jpeg")
                # Simpan ke cache
                _IMAGE_CACHE[url] = {
                    "data": resp.content,
                    "content_type": content_type,
                    "expires": now + _IMAGE_CACHE_TTL
                }
                return Response(
                    resp.content,
                    content_type=content_type,
                    headers={"Cache-Control": "public, max-age=86400", "X-Cache": "MISS"}
                )
            # Jika request gagal, coba kembalikan cache lama (stale) jika ada
            if cached:
                return Response(
                    cached["data"],
                    content_type=cached["content_type"],
                    headers={"Cache-Control": "public, max-age=3600", "X-Cache": "STALE"}
                )
            return jsonify({"error": f"HTTP {resp.status_code}"}), resp.status_code
        except Exception:
            # Timeout atau error koneksi: kembalikan cache lama jika ada
            if cached:
                return Response(
                    cached["data"],
                    content_type=cached["content_type"],
                    headers={"Cache-Control": "public, max-age=3600", "X-Cache": "STALE"}
                )
            return jsonify({"error": "Timeout atau gambar tidak dapat diakses."}), 504

    except Exception as e:
        app.logger.error(f"Image proxy error: {e}")
        return jsonify({"error": "Gagal mengambil gambar dari sumber."}), 502

@app.route("/api/ai-summary", methods=["POST"])
@limiter.limit("10 per minute")
def ai_summary():
    data = request.json or {}
    spec, stats = data.get("spec", {}), data.get("stats", {})
    total = int(stats.get("total", 100))
    
    # Keamanan Input: Truncate strings untuk membatasi panjang input
    cpu_name = str(spec.get('cpuName', 'Unknown'))[:100].strip()
    gpu_name = str(spec.get('gpuName', 'Unknown'))[:100].strip()
    os_name = str(spec.get('os', 'Unknown'))[:100].strip()
    ram_gb = int(spec.get('ramGb', 0))
    vram = float(spec.get('vram', 0))
    disk_free = int(spec.get('diskFree', 0))
    
    prompt = f"""Kamu adalah asisten AI untuk Bisa main nggak?. Buat ringkasan analisis PC dalam Bahasa Indonesia yang ramah dan mudah dipahami pengguna awam.

Spesifikasi PC: CPU: {cpu_name}, RAM: {ram_gb}GB, GPU: {gpu_name} ({vram}GB VRAM), Storage: {disk_free}GB tersedia, OS: {os_name}

Hasil: Bisa dijalankan: {stats.get('canRun',0)}/{total}, Optimal: {stats.get('optimal',0)}/{total}, Tidak memadai: {stats.get('cantRun',0)}/{total}

Tulis ringkasan 3-4 kalimat: kesimpulan umum, highlight unggulan, dan satu saran upgrade jika perlu. Bahasa santai dan friendly."""
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        summary = response.text
    except Exception:
        can_run  = stats.get('canRun', 0)
        optimal  = stats.get('optimal', 0)
        cant_run = stats.get('cantRun', 0)
        cpu_disp = cpu_name if cpu_name else 'prosesormu'
        summary = (
            f"✨ Fitur ringkasan AI segera hadir! "
            f"Sementara itu, berikut hasil analisis singkat PC kamu: "
            f"dari {total} game yang dicek, "
            f"{can_run} bisa dijalankan, {optimal} berjalan optimal, "
            f"dan {cant_run} di luar kemampuan PC saat ini. "
            f"{cpu_disp} kamu sudah cukup mumpuni — "
            f"scroll ke bawah untuk lihat detail lengkapnya! 🚀"
        )
    return jsonify({"summary": summary})

@app.route("/api/download-detector")
def download_detector():
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
    for p in exe_paths:
        if os.path.exists(p):
            return send_file(p, as_attachment=True, download_name="BisaMainNggakYa_Detect.exe")
    for p in py_paths:
        if os.path.exists(p):
            return send_file(p, as_attachment=True, download_name="bisamainggakya_detect.py")
    return jsonify({"error": "Detector belum tersedia."}), 404

def repair_database():
    """Self-healing migration to clean up and correct entries in the DB corrupted by prior ingestion regex bugs."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 1. Hapus game duplikat (case-insensitive & trim whitespace)
        print("\n[DATABASE MIGRATION] Memeriksa dan menghapus game duplikat...")
        try:
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
            print("[DATABASE MIGRATION] Penghapusan data duplikat selesai.")
        except Exception as dup_err:
            print(f"[DATABASE MIGRATION WARNING] Gagal menghapus duplikat: {dup_err}")
            
        cursor.execute("SELECT id, name, raw_cpu_min, raw_gpu_min, raw_cpu_rec, raw_gpu_rec, min_cpu, min_vram, rec_cpu, rec_vram FROM software")
        rows = cursor.fetchall()
        
        from hardware_matcher import split_concatenated_specs
        from ingest_csv import parse_cpu, parse_vram
        
        updates = []
        for r in rows:
            cpu_min_clean = split_concatenated_specs(r["raw_cpu_min"] or "")
            gpu_min_clean = split_concatenated_specs(r["raw_gpu_min"] or "")
            cpu_rec_clean = split_concatenated_specs(r["raw_cpu_rec"] or "")
            gpu_rec_clean = split_concatenated_specs(r["raw_gpu_rec"] or "")
            
            new_min_cpu = parse_cpu(cpu_min_clean)
            new_min_vram = parse_vram(gpu_min_clean)
            new_rec_cpu = parse_cpu(cpu_rec_clean)
            new_rec_vram = parse_vram(gpu_rec_clean)
            
            # Safeguard clamp for CPU scores
            if new_min_cpu > 100000: new_min_cpu = 100000
            if new_rec_cpu > 100000: new_rec_cpu = 100000
            
            db_min_vram = float(r["min_vram"]) if r["min_vram"] is not None else 0.0
            db_rec_vram = float(r["rec_vram"]) if r["rec_vram"] is not None else 0.0
            
            if (new_min_cpu != r["min_cpu"] or 
                abs(new_min_vram - db_min_vram) > 0.01 or 
                new_rec_cpu != r["rec_cpu"] or 
                abs(new_rec_vram - db_rec_vram) > 0.01):
                
                updates.append((
                    new_min_cpu,
                    new_min_vram,
                    new_rec_cpu,
                    new_rec_vram,
                    r["id"]
                ))
                
        if updates:
            print(f"\n[DATABASE MIGRATION] Memperbaiki {len(updates)} baris spesifikasi yang salah akibat bug regex lama...")
            try:
                cursor.executemany("""
                    UPDATE software 
                    SET min_cpu = %s, min_vram = %s, rec_cpu = %s, rec_vram = %s 
                    WHERE id = %s
                """, updates)
                conn.commit()
                print("[DATABASE MIGRATION] Perbaikan database selesai.")
            except Exception as batch_error:
                print(f"[DATABASE MIGRATION WARNING] Batch update gagal: {batch_error}. Mencoba row-by-row...")
                for up in updates:
                    try:
                        cursor.execute("""
                            UPDATE software 
                            SET min_cpu = %s, min_vram = %s, rec_cpu = %s, rec_vram = %s 
                            WHERE id = %s
                        """, up)
                    except Exception as row_error:
                        print(f"[DATABASE MIGRATION ERROR] Gagal mengupdate ID {up[4]}: {row_error}. Data: {up}")
                conn.commit()
                print("[DATABASE MIGRATION] Perbaikan database row-by-row selesai.")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[DATABASE MIGRATION ERROR] Gagal melakukan perbaikan otomatis: {e}")

repair_database()

def auto_seed_database():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM software WHERE cat = 'Game'")
        row = cursor.fetchone()
        count = row[0] if row else 0
        cursor.close()
        conn.close()
        if count == 0:
            print("\n[STARTUP] Database software kosong! Menjalankan auto-seeding dari file CSV...")
            import ingest_csv
            ingest_csv.main()
    except Exception as e:
        print(f"[STARTUP ERROR] Gagal melakukan auto-seeding: {e}")

auto_seed_database()

def auto_analyze_tiers():
    try:
        print("\n[STARTUP] Menjalankan analisis PC Tiers otomatis...")
        import analyze_tiers
        analyze_tiers.main()
    except Exception as e:
        print(f"[STARTUP ERROR] Gagal melakukan analisis PC Tiers otomatis: {e}")

auto_analyze_tiers()

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)

