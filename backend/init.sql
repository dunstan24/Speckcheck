-- SpecCheck.AI — MySQL Seed Script
-- File ini otomatis dijalankan saat MySQL container pertama kali dibuat

CREATE DATABASE IF NOT EXISTS speccheck CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE speccheck;

CREATE TABLE IF NOT EXISTS software (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(150) NOT NULL,
  cat             VARCHAR(50)  NOT NULL,
  icon            VARCHAR(20)  NOT NULL,
  min_cpu         INT          NOT NULL DEFAULT 0,
  min_ram         INT          NOT NULL DEFAULT 0,
  min_vram        FLOAT        NOT NULL DEFAULT 0,
  min_disk        INT          NOT NULL DEFAULT 0,
  rec_cpu         INT          NOT NULL DEFAULT 0,
  rec_ram         INT          NOT NULL DEFAULT 0,
  rec_vram        FLOAT        NOT NULL DEFAULT 0,
  rec_disk        INT          NOT NULL DEFAULT 0,
  url             VARCHAR(255) NULL,
  description     TEXT         NULL,
  cover_image_url VARCHAR(500) NULL,
  raw_cpu_min     VARCHAR(255) NULL,
  raw_gpu_min     VARCHAR(255) NULL,
  raw_cpu_rec     VARCHAR(255) NULL,
  raw_gpu_rec     VARCHAR(255) NULL
);

-- Hapus data lama jika ada (untuk re-seed)
TRUNCATE TABLE software;

