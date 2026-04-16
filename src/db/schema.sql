CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(account_id, name)
);

CREATE TABLE IF NOT EXISTS audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  url TEXT NOT NULL,
  label TEXT,                      -- e.g. "homepage", "checkout", "mobile-homepage"
  device TEXT DEFAULT 'desktop',   -- "desktop" or "mobile"
  score_performance REAL,
  score_accessibility REAL,
  score_best_practices REAL,
  score_seo REAL,
  metric_lcp REAL,                 -- Largest Contentful Paint (ms)
  metric_fid REAL,                 -- First Input Delay / Max Potential FID (ms)
  metric_cls REAL,                 -- Cumulative Layout Shift
  metric_fcp REAL,                 -- First Contentful Paint (ms)
  metric_tti REAL,                 -- Time to Interactive (ms)
  metric_tbt REAL,                 -- Total Blocking Time (ms)
  metric_speed_index REAL,
  raw_json TEXT,                   -- full Lighthouse JSON report (optional, toggleable)
  tags TEXT,                       -- JSON array of strings e.g. '["sprint-42","post-deploy"]'
  run_at TEXT DEFAULT (datetime('now'))
);
