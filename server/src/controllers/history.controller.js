import { getDb } from '../database/db.js';
import executionService from '../services/execution.service.js';
import { maskPhone } from '../utils/phone.js';
import logger from '../services/logger.service.js';
import { DateTime } from 'luxon';

export async function listHistory(req, res, next) {
  try {
    const db = await getDb();
    const { status, search, schedule_id, startDate, endDate, page = 1, limit = 20 } = req.query;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const whereClauses = [];
    const params = [];

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (schedule_id) {
      whereClauses.push('schedule_id = ?');
      params.push(parseInt(schedule_id, 10));
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push('(recipient_phone LIKE ? OR message_snippet LIKE ? OR schedule_name LIKE ?)');
      params.push(term, term, term);
    }

    if (startDate) {
      whereClauses.push('attempted_at_utc >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('attempted_at_utc <= ?');
      params.push(endDate);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countRow = await db.get(`SELECT COUNT(*) as total FROM execution_logs ${whereStr}`, params);
    const total = countRow ? countRow.total : 0;

    const sql = `
      SELECT * FROM execution_logs 
      ${whereStr} 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit, 10), offset);

    const rows = await db.all(sql, params);

    const decorated = rows.map(item => ({
      ...item,
      recipient_phone_masked: maskPhone(item.recipient_phone)
    }));

    res.json({
      success: true,
      data: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        history: decorated
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getHistoryItem(req, res, next) {
  try {
    const { id } = req.params;
    const db = await getDb();

    const item = await db.get(`SELECT * FROM execution_logs WHERE id = ?`, [id]);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Execution record not found.' });
    }

    res.json({
      success: true,
      data: {
        ...item,
        recipient_phone_masked: maskPhone(item.recipient_phone)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function retryExecution(req, res, next) {
  try {
    const { id } = req.params;
    const { confirmUncertain } = req.body;
    const db = await getDb();

    const execution = await db.get(`SELECT * FROM execution_logs WHERE id = ?`, [id]);
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution record not found.' });
    }

    if (!['failed', 'uncertain'].includes(execution.status)) {
      return res.status(400).json({
        success: false,
        error: `Only executions with 'failed' or 'uncertain' status can be retried. Current status is '${execution.status}'.`
      });
    }

    if (execution.status === 'uncertain' && !confirmUncertain) {
      return res.status(400).json({
        success: false,
        error: 'Retrying an UNCERTAIN execution may result in a duplicate message if WhatsApp already received it. Please confirm explicitly before proceeding.',
        requiresConfirmation: true
      });
    }

    // Retrieve original schedule or construct a transient schedule object from log
    let schedule = null;
    if (execution.schedule_id) {
      schedule = await db.get(`SELECT * FROM schedules WHERE id = ?`, [execution.schedule_id]);
    }

    if (!schedule) {
      // If schedule was deleted or unlinked, construct from execution log details
      schedule = {
        id: execution.schedule_id || 0,
        name: execution.schedule_name || 'Manual Retry Job',
        phone_number: execution.recipient_phone,
        message: execution.message_snippet || ''
      };
    }

    logger.info('api', `User initiated manual retry for execution #${id} (Status: ${execution.status})`);

    // Execute retry
    const result = await executionService.executeOccurrence(schedule, execution.scheduled_at_utc, true);

    res.json({
      success: true,
      message: 'Retry attempt submitted.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function clearHistory(req, res, next) {
  try {
    const db = await getDb();
    const sourceParams = req.method === 'DELETE' && req.body && Object.keys(req.body).length > 0 ? req.body : req.query;
    const { scope = 'all', days, status, clearSystemLogs } = sourceParams;

    const whereClauses = [];
    const params = [];

    if (scope === 'older_than' && parseInt(days, 10) > 0) {
      const cutoffDate = DateTime.utc().minus({ days: parseInt(days, 10) }).toISO();
      whereClauses.push('attempted_at_utc < ?');
      params.push(cutoffDate);
    } else if (scope === 'failed_only') {
      whereClauses.push("status IN ('failed', 'skipped', 'uncertain')");
    } else if (scope === 'status' && status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const result = await db.run(`DELETE FROM execution_logs ${whereStr}`, params);
    const deletedExecutions = result.changes || 0;

    let deletedSystemLogs = 0;
    if (clearSystemLogs === 'true' || clearSystemLogs === true) {
      const sysResult = await db.run(`DELETE FROM system_logs`);
      deletedSystemLogs = sysResult.changes || 0;
    }

    logger.info('api', `Cleared ${deletedExecutions} execution logs${deletedSystemLogs > 0 ? ` and ${deletedSystemLogs} system audit logs` : ''}.`);

    res.json({
      success: true,
      message: `Successfully cleared ${deletedExecutions} execution log(s)${deletedSystemLogs > 0 ? ` and ${deletedSystemLogs} system audit log(s)` : ''}.`,
      data: {
        deletedExecutions,
        deletedSystemLogs
      }
    });
  } catch (err) {
    next(err);
  }
}

export default {
  listHistory,
  getHistoryItem,
  retryExecution,
  clearHistory
};
