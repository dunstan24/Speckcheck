# SpecCheck.AI
**Sistem AI untuk Menganalisis Kesesuaian Spesifikasi PC**
Tugas Akhir · Dunstan Devon (220040009) · ITB STIKOM Bali · 2025

---

## ⚡ Cara Menjalankan (3 Langkah)

### Langkah 1 — Isi API Key
Buka file `backend/.env` dan ganti dengan API key kamu:
```
ANTHROPIC_API_KEY=sk-ant-PASTE_YOUR_KEY_HERE
```
Dapatkan API key gratis di: https://console.anthropic.com

---

### Langkah 2 — Jalankan Backend
```
Double-click: START_BACKEND.bat
```
Tunggu sampai muncul: `http://localhost:5000`

---

### Langkah 3 — Jalankan Frontend
```
Double-click: START_FRONTEND.bat
```
Tunggu sampai muncul: `http://localhost:5173`
Browser akan otomatis terbuka. Jika tidak, buka manual di browser.

---

## 📋 Prasyarat

| Software | Download |
|----------|----------|
| Python 3.8+ | https://python.org/downloads — ✅ centang "Add to PATH" |
| Node.js 18+ | https://nodejs.org |

---

## 🗂️ Struktur Project

```
speccheck/
├── START_BACKEND.bat    ← Double-click ini dulu
├── START_FRONTEND.bat   ← Lalu double-click ini
│
├── backend/
│   ├── app.py           Flask API + Claude AI
│   ├── .env             ← ISI API KEY DI SINI
│   ├── requirements.txt
│   └── data/
│       └── software.json  Database 30 software & game
│
├── frontend/
│   ├── src/
│   │   ├── pages/       Home, Manual, Results
│   │   └── components/  Header
│   ├── .env             VITE_API_URL=http://localhost:5000
│   └── package.json
│
└── detector/
    ├── speccheck_detect.py  Deteksi spek PC otomatis
    └── BUILD.bat            Build ke .exe
```

---

## 🔧 Troubleshooting

**Backend error "No module named flask"**
→ Jalankan: `pip install flask flask-cors anthropic python-dotenv`

**Frontend error "npm not found"**
→ Install Node.js dari https://nodejs.org

**AI Summary tidak muncul**
→ Pastikan `backend/.env` sudah diisi dengan API key yang valid

**Port sudah digunakan**
→ Pastikan tidak ada aplikasi lain di port 5000 atau 5173
