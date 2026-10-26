import { initDb, closeDb } from './db.js';

async function runMigration() {
  console.log('[Migration] Initializing SQLite database schema...');
  try {
    await initDb();
    console.log('[Migration] Database schema migrated successfully.');
    await closeDb();
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Failed to migrate database:', err);
    process.exit(1);
  }
}

runMigration();
