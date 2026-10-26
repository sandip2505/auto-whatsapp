import { getDb } from '../database/db.js';
import config from '../config/index.js';
import { isValidTimezone } from '../utils/timezone.js';
import logger from '../services/logger.service.js';
import whatsappService from '../services/whatsapp.service.js';
import { DateTime } from 'luxon';

export async function getSettings(req, res, next) {
  try {
    const db = await getDb();
    const rows = await db.all(`SELECT key, value, updated_at FROM settings`);
    const settingsMap = {};
    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }

    res.json({
      success: true,
      data: {
        settings: settingsMap,
        systemInfo: {
          appVersion: config.appVersion,
          databasePath: config.databasePath,
          nodeVersion: process.version,
          platform: process.platform,
          nodeEnv: config.nodeEnv,
          serverTimeUtc: DateTime.utc().toISO(),
          defaultTimezone: settingsMap.default_timezone || config.defaultTimezone
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const db = await getDb();
    const updates = req.body;
    const nowUtc = DateTime.utc().toISO();
    const allowedKeys = [
      'default_timezone',
      'default_country_code',
      'missed_job_policy',
      'max_retry_attempts',
      'retry_delay_ms',
      'whatsapp_mock'
    ];

    if (updates.default_timezone && !isValidTimezone(updates.default_timezone)) {
      return res.status(400).json({
        success: false,
        error: `Invalid timezone identifier: "${updates.default_timezone}"`
      });
    }

    if (updates.missed_job_policy && !['skip', 'manual_retry'].includes(updates.missed_job_policy)) {
      return res.status(400).json({
        success: false,
        error: `Invalid missed_job_policy. Must be "skip" or "manual_retry".`
      });
    }

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        const valStr = String(updates[key]);
        await db.run(
          `INSERT INTO settings (key, value, updated_at) 
           VALUES (?, ?, ?) 
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, valStr, nowUtc]
        );

        if (key === 'whatsapp_mock') {
          whatsappService.setMockMode(valStr === 'true');
        }
      }
    }

    logger.info('api', 'Settings updated successfully.', updates);

    // Return updated settings
    return getSettings(req, res, next);
  } catch (err) {
    next(err);
  }
}

export async function getSystemLogs(req, res, next) {
  try {
    const { limit = 50, offset = 0, source, level } = req.query;
    const logs = await logger.getRecentLogs(
      parseInt(limit, 10),
      parseInt(offset, 10),
      source || null,
      level || null
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    next(err);
  }
}

export async function clearSystemLogs(req, res, next) {
  try {
    const db = await getDb();
    const result = await db.run(`DELETE FROM system_logs`);
    const deletedCount = result.changes || 0;

    logger.info('api', `Cleared ${deletedCount} system audit log(s).`);

    res.json({
      success: true,
      message: `Successfully cleared ${deletedCount} system audit log(s).`,
      data: { deletedCount }
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getSettings,
  updateSettings,
  getSystemLogs,
  clearSystemLogs
};
