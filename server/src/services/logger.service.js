import { getDb } from '../database/db.js';

class LoggerService {
  /**
   * Log an event into console and database.
   * @param {'info'|'warn'|'error'|'debug'} level 
   * @param {'whatsapp'|'scheduler'|'database'|'api'|'system'} source 
   * @param {string} message 
   * @param {Object|string} [details] 
   */
  async log(level, source, message, details = null) {
    const timestamp = new Date().toISOString();
    const detailsStr = details
      ? (typeof details === 'object' ? JSON.stringify(details) : String(details))
      : null;

    // Console output
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${source}]`;
    if (level === 'error') {
      console.error(`${prefix} ${message}`, detailsStr || '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`, detailsStr || '');
    } else {
      console.log(`${prefix} ${message}`, detailsStr || '');
    }

    // Persist to database if initialized
    try {
      const db = await getDb();
      await db.run(
        `INSERT INTO system_logs (level, source, message, details, created_at) VALUES (?, ?, ?, ?, ?)`,
        [level, source, message, detailsStr, timestamp]
      );
    } catch (err) {
      // Don't crash if database is temporarily unavailable during early startup
      console.error('[LoggerService] Failed to persist system log to DB:', err.message);
    }
  }

  info(source, message, details) {
    return this.log('info', source, message, details);
  }

  warn(source, message, details) {
    return this.log('warn', source, message, details);
  }

  error(source, message, details) {
    return this.log('error', source, message, details);
  }

  debug(source, message, details) {
    return this.log('debug', source, message, details);
  }

  /**
   * Query recent system logs with pagination and filters.
   */
  async getRecentLogs(limit = 50, offset = 0, source = null, level = null) {
    const db = await getDb();
    const whereClauses = [];
    const params = [];

    if (source) {
      whereClauses.push('source = ?');
      params.push(source);
    }
    if (level) {
      whereClauses.push('level = ?');
      params.push(level);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `SELECT * FROM system_logs ${whereStr} ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await db.all(sql, params);
    const countRow = await db.get(`SELECT COUNT(*) as total FROM system_logs ${whereStr}`, params.slice(0, -2));

    return {
      total: countRow?.total || 0,
      logs: rows
    };
  }
}

export const logger = new LoggerService();
export default logger;
