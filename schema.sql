-- Schéma Cloudflare D1 pour EPITA Smart Classroom
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  views_count INTEGER DEFAULT 0,
  engine TEXT DEFAULT 'Vision IA Gemini',
  total_items INTEGER DEFAULT 0,
  status TEXT DEFAULT '',
  report TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
