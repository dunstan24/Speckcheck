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

INSERT INTO software (id, name, cat, icon, min_cpu, min_ram, min_vram, min_disk, rec_cpu, rec_ram, rec_vram, rec_disk) VALUES
-- Office
(1,  'Microsoft Word',       'Office',        '📝', 1000, 4,  0,  4,   2000, 8,  0,  10),
(2,  'Microsoft Excel',      'Office',        '📊', 1000, 4,  0,  4,   2000, 8,  0,  10),
(3,  'Microsoft PowerPoint', 'Office',        '📑', 1000, 4,  0,  4,   2000, 8,  0,  10),
-- Creative
(4,  'Adobe Photoshop',      'Creative',      '🎨', 2000, 8,  2,  20,  3500, 16, 4,  50),
(5,  'Adobe Premiere Pro',   'Creative',      '🎬', 3000, 16, 4,  50,  4000, 32, 8,  100),
(6,  'Adobe After Effects',  'Creative',      '✨', 3000, 16, 4,  50,  4000, 32, 8,  100),
(7,  'Blender',              'Creative',      '🌀', 2000, 8,  2,  20,  4000, 32, 8,  50),
(24, 'DaVinci Resolve',      'Creative',      '🎞️', 3000, 16, 4,  50,  4000, 32, 8,  100),
-- Dev
(8,  'Visual Studio Code',   'Dev',           '💻', 1000, 2,  0,  2,   2000, 8,  0,  10),
(9,  'Android Studio',       'Dev',           '📱', 2000, 8,  0,  30,  3000, 16, 0,  60),
(10, 'Unity',                'Dev',           '🎮', 2000, 8,  2,  20,  3500, 16, 4,  50),
-- Communication
(11, 'Zoom',                 'Communication', '📹', 1000, 4,  0,  5,   2000, 8,  0,  10),
-- Browser
(12, 'Google Chrome',        'Browser',       '🌐', 1000, 4,  0,  5,   2000, 8,  0,  20),
-- Engineering / Design / Streaming
(25, 'AutoCAD',              'Engineering',   '📐', 2500, 8,  1,  10,  3500, 16, 4,  20),
(26, 'Figma',                'Design',        '🖼️', 1500, 4,  0,  5,   2500, 8,  0,  10),
(27, 'OBS Studio',           'Streaming',     '📡', 2000, 8,  2,  10,  3500, 16, 4,  30),
-- Games
(13, 'Minecraft Java',       'Game',          '⛏️', 2000, 8,  1,  10,  3000, 16, 4,  30),
(14, 'Valorant',             'Game',          '🔫', 2000, 4,  1,  35,  3500, 16, 4,  35),
(15, 'CS2',                  'Game',          '💣', 2000, 8,  1,  60,  3500, 16, 4,  60),
(16, 'GTA V',                'Game',          '🚗', 2000, 8,  2,  90,  3500, 16, 8,  90),
(17, 'Cyberpunk 2077',       'Game',          '🤖', 3000, 8,  6,  70,  4000, 16, 12, 70),
(18, 'Fortnite',             'Game',          '🏗️', 2000, 8,  2,  30,  3500, 16, 8,  30),
(19, 'League of Legends',    'Game',          '⚔️', 2000, 4,  1,  25,  3000, 8,  4,  25),
(20, 'Dota 2',               'Game',          '🧙', 2000, 4,  1,  20,  3000, 8,  4,  20),
(21, 'Red Dead Redemption 2','Game',          '🤠', 3000, 12, 4,  150, 4000, 16, 8,  150),
(22, 'Elden Ring',           'Game',          '💀', 3000, 12, 4,  60,  4000, 16, 8,  60),
(23, 'The Witcher 3',        'Game',          '🗡️', 2500, 8,  4,  50,  3500, 16, 8,  50),
(28, 'Overwatch 2',          'Game',          '🦸', 2500, 8,  2,  50,  3500, 16, 8,  50),
(29, 'Apex Legends',         'Game',          '🎯', 2500, 8,  2,  56,  3500, 16, 4,  56),
(30, 'PUBG',                 'Game',          '🪖', 2500, 8,  2,  40,  3500, 16, 4,  40);
