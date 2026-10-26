import { getDb } from '../database/db.js';
import schedulerService from '../services/scheduler.service.js';
import { validateSchedulePayload } from '../validators/schedule.validator.js';
import { getHumanSummary, formatInTimezone } from '../utils/timezone.js';
import logger from '../services/logger.service.js';
import { DateTime } from 'luxon';

export async function listSchedules(req, res, next) {
  try {
    const db = await getDb();
    const { search, status, type, page = 1, limit = 20 } = req.query;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const whereClauses = ["status != 'deleted'"];
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push('(name LIKE ? OR recipient_name LIKE ? OR phone_number LIKE ? OR message LIKE ?)');
      params.push(term, term, term, term);
    }

    if (status && ['active', 'paused', 'completed'].includes(status)) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (type && ['one_time', 'interval', 'every_10_minutes', 'daily', 'weekly', 'monthly'].includes(type)) {
      whereClauses.push('schedule_type = ?');
      params.push(type);
    }

    const whereStr = `WHERE ${whereClauses.join(' AND ')}`;
    const countRow = await db.get(`SELECT COUNT(*) as total FROM schedules ${whereStr}`, params);
    const total = countRow ? countRow.total : 0;

    const sql = `
      SELECT * FROM schedules 
      ${whereStr} 
      ORDER BY 
        CASE WHEN status = 'active' THEN 0 WHEN status = 'paused' THEN 1 ELSE 2 END,
        next_run_at_utc ASC,
        id DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit, 10), offset);

    const rows = await db.all(sql, params);

    // Decorate rows with human summary and formatted dates
    const decorated = rows.map(s => ({
      ...s,
      human_summary: getHumanSummary(s),
      recurrence_config: s.recurrence_config ? JSON.parse(s.recurrence_config) : null,
      next_run_formatted: s.next_run_at_utc ? formatInTimezone(s.next_run_at_utc, s.timezone) : null
    }));

    res.json({
      success: true,
      data: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        schedules: decorated
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getSchedule(req, res, next) {
  try {
    const db = await getDb();
    const { id } = req.params;

    const schedule = await db.get(`SELECT * FROM schedules WHERE id = ? AND status != 'deleted'`, [id]);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found.' });
    }

    const recentExecutions = await db.all(
      `SELECT * FROM execution_logs WHERE schedule_id = ? ORDER BY id DESC LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...schedule,
        human_summary: getHumanSummary(schedule),
        recurrence_config: schedule.recurrence_config ? JSON.parse(schedule.recurrence_config) : null,
        next_run_formatted: schedule.next_run_at_utc ? formatInTimezone(schedule.next_run_at_utc, schedule.timezone) : null,
        recent_executions: recentExecutions
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function createSchedule(req, res, next) {
  try {
    const validation = validateSchedulePayload(req.body, false);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const db = await getDb();
    const d = validation.data;
    const nowUtc = DateTime.utc().toISO();

    const result = await db.run(
      `INSERT INTO schedules (
        name, recipient_name, phone_number, message, schedule_type,
        scheduled_at_utc, timezone, recurrence_config, start_at_utc,
        end_at_utc, next_run_at_utc, enabled, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.name || null,
        d.recipient_name || null,
        d.phone_number,
        d.message,
        d.schedule_type,
        d.scheduled_at_utc || null,
        d.timezone,
        d.recurrence_config || null,
        d.start_at_utc || null,
        d.end_at_utc || null,
        d.next_run_at_utc || null,
        d.enabled,
        d.status,
        nowUtc,
        nowUtc
      ]
    );

    const scheduleId = result.lastID;
    logger.info('api', `Created new schedule #${scheduleId} ("${d.name || 'Untitled'}")`);

    await schedulerService.refreshSchedule(scheduleId);

    const created = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);
    res.status(201).json({
      success: true,
      data: {
        ...created,
        human_summary: getHumanSummary(created),
        recurrence_config: created.recurrence_config ? JSON.parse(created.recurrence_config) : null
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const db = await getDb();

    const existing = await db.get(`SELECT * FROM schedules WHERE id = ? AND status != 'deleted'`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Schedule not found.' });
    }

    const validation = validateSchedulePayload(req.body, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const d = { ...existing, ...validation.data };
    const nowUtc = DateTime.utc().toISO();

    await db.run(
      `UPDATE schedules SET
        name = ?, recipient_name = ?, phone_number = ?, message = ?,
        schedule_type = ?, scheduled_at_utc = ?, timezone = ?,
        recurrence_config = ?, start_at_utc = ?, end_at_utc = ?,
        enabled = ?, status = ?, updated_at = ?
      WHERE id = ?`,
      [
        d.name || null,
        d.recipient_name || null,
        d.phone_number,
        d.message,
        d.schedule_type,
        d.scheduled_at_utc || null,
        d.timezone,
        d.recurrence_config || null,
        d.start_at_utc || null,
        d.end_at_utc || null,
        d.enabled,
        d.status,
        nowUtc,
        id
      ]
    );

    await schedulerService.refreshSchedule(id);

    const updated = await db.get(`SELECT * FROM schedules WHERE id = ?`, [id]);
    logger.info('api', `Updated schedule #${id}`);

    res.json({
      success: true,
      data: {
        ...updated,
        human_summary: getHumanSummary(updated),
        recurrence_config: updated.recurrence_config ? JSON.parse(updated.recurrence_config) : null
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { enabled, status } = req.body;
    const db = await getDb();

    const existing = await db.get(`SELECT * FROM schedules WHERE id = ? AND status != 'deleted'`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Schedule not found.' });
    }

    const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled;
    const newStatus = status || (newEnabled ? 'active' : 'paused');

    await db.run(
      `UPDATE schedules SET enabled = ?, status = ?, updated_at = ? WHERE id = ?`,
      [newEnabled, newStatus, DateTime.utc().toISO(), id]
    );

    await schedulerService.refreshSchedule(id);

    const updated = await db.get(`SELECT * FROM schedules WHERE id = ?`, [id]);
    logger.info('api', `Changed schedule #${id} status to ${newStatus} (enabled: ${newEnabled})`);

    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const db = await getDb();

    const existing = await db.get(`SELECT * FROM schedules WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Schedule not found.' });
    }

    // Unlink execution logs schedule_id and delete schedule to prevent future execution while preserving logs
    await db.run(`UPDATE execution_logs SET schedule_id = NULL WHERE schedule_id = ?`, [id]);
    await db.run(`DELETE FROM schedules WHERE id = ?`, [id]);

    logger.info('api', `Deleted schedule #${id}. Historical execution logs preserved.`);

    res.json({
      success: true,
      message: `Schedule #${id} deleted successfully. Execution history preserved.`
    });
  } catch (err) {
    next(err);
  }
}

export async function duplicateSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const db = await getDb();

    const original = await db.get(`SELECT * FROM schedules WHERE id = ? AND status != 'deleted'`, [id]);
    if (!original) {
      return res.status(404).json({ success: false, error: 'Original schedule not found.' });
    }

    const nowUtc = DateTime.utc().toISO();
    const newName = original.name ? `${original.name} (Copy)` : 'Copy of Schedule';

    const insertResult = await db.run(
      `INSERT INTO schedules (
        name, recipient_name, phone_number, message, schedule_type,
        scheduled_at_utc, timezone, recurrence_config, start_at_utc,
        end_at_utc, next_run_at_utc, enabled, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 'paused', ?, ?)`,
      [
        newName,
        original.recipient_name,
        original.phone_number,
        original.message,
        original.schedule_type,
        original.scheduled_at_utc,
        original.timezone,
        original.recurrence_config,
        original.start_at_utc,
        original.end_at_utc,
        nowUtc,
        nowUtc
      ]
    );

    const newId = insertResult.lastID;
    logger.info('api', `Duplicated schedule #${id} into new paused schedule #${newId}`);

    const created = await db.get(`SELECT * FROM schedules WHERE id = ?`, [newId]);
    res.status(201).json({
      success: true,
      data: {
        ...created,
        human_summary: getHumanSummary(created),
        recurrence_config: created.recurrence_config ? JSON.parse(created.recurrence_config) : null
      }
    });
  } catch (err) {
    next(err);
  }
}

export default {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  updateStatus,
  deleteSchedule,
  duplicateSchedule
};
