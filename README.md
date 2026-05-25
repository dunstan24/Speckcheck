# SpecCheck.AI 🖥️
**Sistem AI untuk Menganalisis Kesesuaian Spesifikasi PC**
Tugas Akhir · Dunstan Devon (220040009) · ITB STIKOM Bali · 2025

---

## 🐳 Apa Itu Docker?

**Docker** adalah aplikasi yang membuat "kotak virtual" (*container*) untuk menjalankan program. Bedanya dengan install biasa:

| Install Biasa | Docker |
|---------------|--------|
| Harus install Python, Node, MySQL satu-satu | Install Docker sekali, semua langsung jalan |
| Bisa konflik versi antar project | Tiap project punya kotak sendiri, tidak saling ganggu |
| "Di komputerku jalan, di komputermu tidak" | Sama persis di semua komputer |

---

## ⚙️ Prasyarat — Install Dulu

### 1. Docker Desktop
Download dan install dari: **https://www.docker.com/products/docker-desktop/**

> Setelah install, **restart komputer**, lalu buka Docker Desktop. Pastikan ada ikon Docker di taskbar (pojok kanan bawah) dan statusnya **"Engine running"**.

### 2. Git (opsional, jika clone dari repo)
Atau cukup download ZIP dari GitHub.

---

## 🔑 Langkah 1 — Isi API Key Gemini

Buka file **`backend/.env`** dan isi bagian ini:

```
GEMINI_API_KEY=PASTE_YOUR_GEMINI_API_KEY_HERE
```

Ganti `PASTE_YOUR_GEMINI_API_KEY_HERE` dengan API key kamu.
Dapatkan **gratis** di: https://aistudio.google.com/app/apikey

> ⚠️ Jangan ganti nilai `DB_HOST`, `DB_PORT`, dll — itu sudah dikonfigurasi untuk Docker.
> Jika API key kosong, aplikasi tetap berjalan normal dengan teks ringkasan otomatis.

---

## 🚀 Langkah 2 — Jalankan Semua dengan 1 Perintah

Buka terminal (CMD atau PowerShell), masuk ke folder project:

```bash
cd C:\Users\USER\Desktop\speccheck
```

Lalu jalankan:

```bash
docker compose up
```

### Yang akan terjadi (proses pertama kali ±3-5 menit):

```
[+] Building ...          ← Docker mendownload dan membangun image
[+] Running 3/3
  ✔ Container speccheck_db        Started   ← MySQL siap
  ✔ Container speccheck_backend   Started   ← Backend Flask siap
  ✔ Container speccheck_frontend  Started   ← Frontend Vite siap
```

Tunggu sampai muncul baris seperti ini di log:
```
speccheck_frontend  |   ➜  Local:   http://localhost:5173/
speccheck_backend   |  * Running on all addresses (0.0.0.0)
```

### Buka di browser:
```
http://localhost:5173
```

> ✅ **Selesai!** Aplikasi sudah berjalan.

---

## 🔄 Cara Menghentikan

Tekan `Ctrl + C` di terminal untuk stop semua container.

Atau jika dijalankan di background (mode detached):
```bash
docker compose down
```

---

## 📋 Perintah Docker yang Sering Digunakan

```bash
# Jalankan semua container (log tampil di terminal)
docker compose up

# Jalankan di background (terminal bisa ditutup)
docker compose up -d

# Lihat log semua container
docker compose logs -f

# Lihat log hanya backend
docker compose logs -f backend

# Cek status semua container
docker compose ps

# Stop semua container
docker compose down

# Stop + hapus data database (WARNING: data hilang!)
docker compose down -v

# Rebuild image setelah ubah Dockerfile atau requirements.txt
docker compose up --build
```

---

## 🗂️ Struktur Project

```
speccheck/
├── docker-compose.yml       ← Konfigurasi utama Docker (3 service)
│
├── backend/
│   ├── Dockerfile           ← Blueprint image Python/Flask
│   ├── app.py               ← Flask API + Gemini AI + MySQL
│   ├── init.sql             ← Seed data 30 software (auto-import ke MySQL)
│   ├── .env                 ← ⬅ ISI GEMINI_API_KEY DI SINI
│   └── requirements.txt     ← Daftar library Python
│
├── frontend/
│   ├── Dockerfile           ← Blueprint image Node/Vite
│   ├── src/                 ← Source code React (edit di sini untuk hot-reload)
│   └── vite.config.js
│
└── detector/
    └── speccheck_detect.py  ← Deteksi spesifikasi PC otomatis
```

---

## 🔧 Troubleshooting

### ❌ "docker: command not found" atau "docker compose not found"
→ Docker Desktop belum terinstall atau belum dibuka. Buka Docker Desktop terlebih dahulu.

### ❌ Port 5000 atau 5173 sudah digunakan
```bash
# Cek proses yang pakai port 5000
netstat -ano | findstr :5000
```
→ Tutup aplikasi yang menggunakan port tersebut, atau ganti port di `docker-compose.yml`.

### ❌ Frontend tidak bisa akses backend ("Network Error")
→ Pastikan `frontend/.env` berisi:
```
VITE_API_URL=http://localhost:5000
```

### ❌ Container backend langsung stop / restart terus
```bash
# Lihat log error backend
docker compose logs backend
```
→ Biasanya karena MySQL belum siap. Tunggu 30 detik lalu coba lagi:
```bash
docker compose restart backend
```

### ❌ Perubahan kode tidak muncul di browser
→ Jika ubah file di `frontend/src/` → browser **auto-refresh** (hot-reload).
→ Jika ubah `backend/app.py` → Flask **auto-restart** (debug mode).
→ Jika ubah `Dockerfile` atau `requirements.txt` → perlu rebuild:
```bash
docker compose up --build
```

### ❌ Mau reset database ke data awal
```bash
docker compose down -v    # hapus volume database
docker compose up         # mulai ulang, data ter-seed otomatis
```

---

## 📌 Port yang Digunakan

| Service | Port | Akses |
|---------|------|-------|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (Flask) | 5000 | http://localhost:5000/api/health |
| MySQL | 3306 | localhost:3306 (untuk tools seperti DBeaver) |
