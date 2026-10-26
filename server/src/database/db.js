import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

let dbInstance = null;

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure database directory exists
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Open database connection
  dbInstance = await open({
    filename: config.databasePath,
    driver: sqlite3.Database
  });

  // Enable WAL mode, busy timeout, and foreign key constraints
  await dbInstance.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
  `);

  return dbInstance;
}

export async function initDb() {
  const db = await getDb();
  
  // Read schema.sql
  const schemaPath = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Execute schema creation
  await db.exec(schemaSql);

  // Migration check: ensure schedule_name exists in execution_logs
  try {
    const tableInfo = await db.all(`PRAGMA table_info(execution_logs)`);
    const hasScheduleName = tableInfo.some(col => col.name === 'schedule_name');
    if (!hasScheduleName) {
      await db.exec(`ALTER TABLE execution_logs ADD COLUMN schedule_name TEXT;`);
    }

    // Migration check: ensure schedule_type constraint includes interval
    const tableMaster = await db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='schedules'`);
    if (tableMaster && !tableMaster.sql.includes('interval')) {
      await db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE schedules_new (
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
        INSERT INTO schedules_new SELECT * FROM schedules;
        DROP TABLE schedules;
        ALTER TABLE schedules_new RENAME TO schedules;
        CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at_utc, enabled, status);
        CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
        PRAGMA foreign_keys = ON;
      `);
    }
  } catch (migErr) {
    console.warn('[DB Migration Warning]:', migErr.message);
  }

  // Initialize default settings if empty
  const defaultSettings = [
    { key: 'default_timezone', value: config.defaultTimezone },
    { key: 'default_country_code', value: config.defaultCountryCode },
    { key: 'missed_job_policy', value: config.missedJobPolicy },
    { key: 'max_retry_attempts', value: String(config.maxRetryAttempts) },
    { key: 'retry_delay_ms', value: String(config.retryDelayMs) },
    { key: 'app_version', value: config.appVersion },
    { key: 'whatsapp_mock', value: String(config.whatsappMock) }
  ];

  const now = new Date().toISOString();
  for (const item of defaultSettings) {
    await db.run(
      `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
      [item.key, item.value, now]
    );
  }

  return db;
}

export async function closeDb() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

export default {
  getDb,
  initDb,
  closeDb
};
