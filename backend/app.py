"""Bisa Main Nggak Ya — Flask Backend (MySQL edition)"""
import os, time, secrets, smtplib, random, string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests as req_lib
from hardware_matcher import match_cpu, match_gpu, resolve_game_requirement, get_cpus, get_gpus
import mysql.connector
import google.generativeai as genai
from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app)

# Rate Limiter (in-memory storage untuk single-instance)
limiter = Limiter(get_remote_address, app=app, default_limits=[],
                  storage_uri="memory://")

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# ─── Security Token System (with token_version & expiry) ─────────────────────
import hmac
import hashlib
import base64
import json

SECRET_KEY = os.environ.get("FLASK_SECRET", "speccheck_secure_key_2026")
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
                host=os.environ.get("DB_HOST", "localhost"),
                port=int(os.environ.get("DB_PORT", 3306)),
                database=os.environ.get("DB_NAME", "speccheck"),
                user=os.environ.get("DB_USER", "speccheck"),
                password=os.environ.get("DB_PASSWORD", "speccheck123"),
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
        "icon": "🎮",
        "min":  {"cpu": r["min_cpu"], "ram": r["min_ram"],
                 "vram": float(r["min_vram"]), "disk": r["min_disk"],
                 "gpu_score": float(r["min_vram"]) * 3000},
        "rec":  {"cpu": r["rec_cpu"], "ram": r["rec_ram"],
                 "vram": float(r["rec_vram"]), "disk": r["rec_disk"],
                 "gpu_score": float(r["rec_vram"]) * 3000},
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
        # Migrasi kolom baru jika tabel sudah ada dari versi lama
        migration_cols = [
            ("email", "VARCHAR(255) UNIQUE NULL"),
            ("google_id", "VARCHAR(255) UNIQUE NULL"),
            ("auth_provider", "VARCHAR(20) NOT NULL DEFAULT 'local'"),
            ("email_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("token_version", "INT NOT NULL DEFAULT 0"),
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



# ─── Analisis ────────────────────────────────────────────────────────────────

# Cache resolve results agar tidak compute ulang untuk game yang sama
_resolve_cache = {}

def resolve_cached(raw_cpu, raw_gpu):
    key = (raw_cpu, raw_gpu)
    if key not in _resolve_cache:
        _resolve_cache[key] = resolve_game_requirement(raw_cpu, raw_gpu)
    return _resolve_cache[key]

def analyze_one(spec, sw, cpu_score, gpu_score):
    """Hitung grade game vs spesifikasi user. cpu_score & gpu_score sudah di-resolve sebelumnya."""
    # Resolve game requirements secara lazy (cached)
    raw = sw.get("raw", {})
    min_cpu_score, min_gpu_score = resolve_cached(raw.get("cpu_min", ""), raw.get("gpu_min", ""))
    rec_cpu_score, rec_gpu_score = resolve_cached(raw.get("cpu_rec", ""), raw.get("gpu_rec", ""))

    # Gabungkan dengan nilai numerik dari DB sebagai fallback
    min_cpu = int(min_cpu_score) or sw["min"]["cpu"]
    min_gpu = float(min_gpu_score) or sw["min"]["gpu_score"]
    rec_cpu = int(rec_cpu_score) or sw["rec"]["cpu"]
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
        elif rec > 0 and user >= rec:
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
    return jsonify({"status": "ok", "message": "Bisa Main Nggak Ya Backend berjalan"})

# ─── Auth Routes ─────────────────────────────────────────────────────────────
from werkzeug.security import generate_password_hash, check_password_hash

def _send_reset_email(to_email, reset_token):
    """Kirim email reset password via SMTP."""
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    from_email = os.environ.get("SMTP_FROM_EMAIL", smtp_user)
    if not smtp_host or not smtp_user:
        print("[EMAIL] SMTP tidak dikonfigurasi, skip kirim email.")
        return False
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Bisa Main Nggak Ya — Reset Password"
    msg["From"] = from_email
    msg["To"] = to_email
    html = f"""<html><body style="font-family:sans-serif;background:#050a0f;color:#e8f4ff;padding:2rem;">
    <h2 style="color:#00d4ff;">⚡ Bisa Main Nggak Ya</h2>
    <p>Anda menerima email ini karena ada permintaan reset password untuk akun Anda.</p>
    <p><a href="{reset_url}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#00d4ff,#7b2fff);color:#000;font-weight:700;border-radius:8px;text-decoration:none;">Reset Password Saya</a></p>
    <p style="color:#7ab3d4;font-size:0.85rem;">Link ini berlaku selama 20 menit. Jika Anda tidak meminta reset, abaikan email ini.</p>
    </body></html>"""
    msg.attach(MIMEText(html, "html"))
    try:
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()
        print(f"[EMAIL] Reset password email terkirim ke {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL] Gagal kirim email: {e}")
        return False

@app.route("/api/auth/register", methods=["POST"])
@limiter.limit("3/15 minutes")
def auth_register():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    if not username or not password:
        return jsonify({"error": "Username dan password diperlukan"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password minimal 8 karakter"}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": "Username sudah terdaftar"}), 400
        
        hashed = generate_password_hash(password)
        cursor.execute(
            "INSERT INTO users (username, password_hash, role, auth_provider) VALUES (%s, %s, 'user', 'local')",
            (username, hashed)
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
        return jsonify({"error": str(e)}), 500

@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("5/15 minutes")
def auth_login():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    if not username or not password:
        return jsonify({"error": "Username dan password diperlukan"}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user:
            return jsonify({"error": "Username atau password salah"}), 401
        
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
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"error": str(e)}), 500

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
@limiter.limit("3/15 minutes")
def auth_forgot_password():
    """Kirim link reset password — hanya untuk akun Google yang punya email."""
    data = request.json or {}
    identifier = data.get("email", data.get("username", "")).strip()
    # Respons generik untuk semua kasus (anti-enumeration)
    generic_msg = "Jika akun terdaftar, link reset telah dikirim ke email Anda."
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
        if user and user["auth_provider"] == "google" and user["email"]:
            # Generate reset token
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            from datetime import datetime, timedelta
            expires = datetime.utcnow() + timedelta(minutes=20)
            cursor.execute("""
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                VALUES (%s, %s, %s)
            """, (user["id"], token_hash, expires))
            conn.commit()
            # Kirim email
            _send_reset_email(user["email"], raw_token)
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[FORGOT-PW] Error: {e}")
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
        return jsonify({"error": str(e)}), 500


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
        return jsonify({"error": str(e)}), 500


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
        return jsonify({"error": str(e)}), 500


# ─── Admin Routes ─────────────────────────────────────────────────────────────

@app.route("/api/admin/games-incomplete")
def admin_games_incomplete():
    auth_header = request.headers.get("Authorization")
    user_id, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Game belum lengkap adalah game yang semua spesifikasi minimumnya 0
        cursor.execute("""
            SELECT id, name, cover_image_url, url 
            FROM software 
            WHERE min_cpu = 0 AND min_ram = 0 AND min_vram = 0 AND min_disk = 0
            ORDER BY name
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({"games": rows})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/users")
def admin_users():
    auth_header = request.headers.get("Authorization")
    user_id, role = verify_token(auth_header)
    if role != "admin":
        return jsonify({"error": "Forbidden"}), 403
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Ambil semua user biasa beserta speknya
        cursor.execute("""
            SELECT u.id, u.username, u.created_at, 
                   s.cpu, s.ram, s.vram, s.disk, s.cpu_name, s.gpu_name, s.os 
            FROM users u 
            LEFT JOIN user_specs s ON u.id = s.user_id 
            WHERE u.role = 'user'
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
                "created_at": r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if r["created_at"] else None,
                "spec": spec
            })
        return jsonify({"users": users_list})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"error": str(e)}), 500

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
        return jsonify(row_to_sw(row))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

    # Resolve user CPU/GPU SEKALI untuk semua game (bukan per-game)
    cpu_score, _ = match_cpu(spec["cpuName"], spec["cpu"])
    gpu_score, _ = match_gpu(spec["gpuName"], spec["vram"])

    # Batasi ke 50 game jika ada pencarian, atau 60 game default
    limit = 50 if search_query else 60
    software_db = fetch_software_by_search(search_query, limit=limit)
    
    results = [{**sw, "result": analyze_one(spec, sw, cpu_score, gpu_score)} for sw in software_db]
    stats = {
        "canRun":  sum(1 for r in results if r["result"]["totalScore"] >= 50),
        "optimal": sum(1 for r in results if r["result"]["totalScore"] >= 90),
        "cantRun": sum(1 for r in results if r["result"]["totalScore"] < 25),
        "gamesOk": sum(1 for r in results if r["cat"] == "Game" and r["result"]["totalScore"] >= 70),
        "total":   len(results),
    }

    # Dapatkan 10 game populer yang bisa dijalankan komputernya
    popular_db = fetch_popular_games()
    popular_analyzed = [{**sw, "result": analyze_one(spec, sw, cpu_score, gpu_score)} for sw in popular_db]
    # Grade S, A, atau B (totalScore >= 50)
    popular_runnable = [r for r in popular_analyzed if r["result"]["totalScore"] >= 50]
    popular_runnable = popular_runnable[:10]

    return jsonify({"results": results, "stats": stats, "popularRunnable": popular_runnable})

@app.route("/api/image-proxy")
def image_proxy():
    """Proxy gambar dari PCGamingWiki untuk bypass hotlinking protection."""
    url = request.args.get("url", "")
    if not url:
        return jsonify({"error": "URL diperlukan"}), 400
    
    # Keamanan SSRF: Parse URL secara aman
    from urllib.parse import urlparse
    try:
        parsed_url = urlparse(url)
        if parsed_url.scheme not in ["http", "https"]:
            return jsonify({"error": "Skema URL tidak valid"}), 400
            
        hostname = parsed_url.hostname
        if not hostname:
            return jsonify({"error": "Domain tidak valid"}), 400
            
        allowed_domains = ["pcgamingwiki.com", "thumbnails.pcgamingwiki.com", "images.pcgamingwiki.com"]
        is_allowed = False
        for domain in allowed_domains:
            if hostname == domain or hostname.endswith("." + domain):
                is_allowed = True
                break
                
        if not is_allowed:
            return jsonify({"error": "Domain tidak diizinkan"}), 403
            
        resp = req_lib.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.pcgamingwiki.com/",
        })
        if resp.status_code != 200:
            return jsonify({"error": f"HTTP {resp.status_code}"}), resp.status_code
        content_type = resp.headers.get("Content-Type", "image/jpeg")
        return Response(resp.content, content_type=content_type,
                        headers={"Cache-Control": "public, max-age=86400"})
    except Exception as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/ai-summary", methods=["POST"])
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
    
    prompt = f"""Kamu adalah asisten AI untuk Bisa Main Nggak Ya. Buat ringkasan analisis PC dalam Bahasa Indonesia yang ramah dan mudah dipahami pengguna awam.

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

if __name__ == "__main__":
    print("\n  ╔══════════════════════════════════════╗")
    print("  ║   Bisa Main Nggak Ya Backend — Running ║")
    print("  ║   http://localhost:5000              ║")
    print("  ╚══════════════════════════════════════╝\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
