-- WhatsApp Scheduler SQLite Schema

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    recipient_name TEXT,
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK(schedule_type IN ('one_time', 'interval', 'every_10_minutes', 'daily', 'weekly', 'monthly')),
    scheduled_at_utc TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    recurrence_config TEXT,
    start_at_utc TEXT,
    end_at_utc TEXT,
    next_run_at_utc TEXT,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'deleted')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at_utc, enabled, status);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

CREATE TABLE IF NOT EXISTS execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER,
    schedule_name TEXT,
    scheduled_occurrence_key TEXT NOT NULL UNIQUE,
    scheduled_at_utc TEXT NOT NULL,
    attempted_at_utc TEXT NOT NULL,
    finished_at_utc TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'sending', 'accepted', 'failed', 'skipped', 'uncertain')),
    whatsapp_message_id TEXT,
    error_code TEXT,
    error_message TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    recipient_phone TEXT NOT NULL,
    message_snippet TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_schedule_id ON execution_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_execution_status ON execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_execution_scheduled_at ON execution_logs(scheduled_at_utc);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL CHECK(level IN ('info', 'warn', 'error', 'debug')),
    source TEXT NOT NULL CHECK(source IN ('whatsapp', 'scheduler', 'database', 'api', 'system')),
    message TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source);
