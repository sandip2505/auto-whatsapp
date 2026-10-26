import { getDb } from '../database/db.js';
import whatsappService from '../services/whatsapp.service.js';
import { getHumanSummary, formatInTimezone, isValidTimezone } from '../utils/timezone.js';
import { maskPhone } from '../utils/phone.js';
import { DateTime } from 'luxon';
import config from '../config/index.js';

export async function getDashboardStats(req, res, next) {
  try {
    const db = await getDb();

    // Determine timezone for calculating "today"
    let tz = req.query.timezone;
    if (!tz || !isValidTimezone(tz)) {
      const dbTz = await db.get(`SELECT value FROM settings WHERE key = 'default_timezone'`);
      tz = dbTz?.value || config.defaultTimezone || 'Asia/Kolkata';
    }

    const nowInTz = DateTime.now().setZone(tz);
    const todayStartUtc = nowInTz.startOf('day').toUTC().toISO();
    const todayEndUtc = nowInTz.endOf('day').toUTC().toISO();

    // Query schedule counts
    const scheduleCounts = await db.get(`
      SELECT 
        COUNT(*) as total_schedules,
        SUM(CASE WHEN status = 'active' AND enabled = 1 THEN 1 ELSE 0 END) as active_schedules,
        SUM(CASE WHEN status = 'paused' OR enabled = 0 THEN 1 ELSE 0 END) as paused_schedules
      FROM schedules WHERE status != 'deleted'
    `);

    // Query execution counts (all-time and today)
    const executionCounts = await db.get(`
      SELECT 
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as successful_sends,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_sends,
        SUM(CASE WHEN status = 'uncertain' THEN 1 ELSE 0 END) as uncertain_sends,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped_sends,
        SUM(CASE WHEN status = 'accepted' AND attempted_at_utc >= ? AND attempted_at_utc <= ? THEN 1 ELSE 0 END) as today_successful_sends,
        SUM(CASE WHEN status = 'failed' AND attempted_at_utc >= ? AND attempted_at_utc <= ? THEN 1 ELSE 0 END) as today_failed_sends,
        SUM(CASE WHEN attempted_at_utc >= ? AND attempted_at_utc <= ? THEN 1 ELSE 0 END) as today_total_sends
      FROM execution_logs
    `, [todayStartUtc, todayEndUtc, todayStartUtc, todayEndUtc, todayStartUtc, todayEndUtc]);

    // Query next scheduled message
    const nextSchedule = await db.get(`
      SELECT * FROM schedules 
      WHERE enabled = 1 
        AND status = 'active' 
        AND next_run_at_utc IS NOT NULL 
      ORDER BY next_run_at_utc ASC 
      LIMIT 1
    `);

    let decoratedNextSchedule = null;
    if (nextSchedule) {
      decoratedNextSchedule = {
        ...nextSchedule,
        human_summary: getHumanSummary(nextSchedule),
        next_run_formatted: formatInTimezone(nextSchedule.next_run_at_utc, nextSchedule.timezone)
      };
    }

    // Recent 5 execution logs
    const recentExecutions = await db.all(`
      SELECT * FROM execution_logs 
      ORDER BY id DESC 
      LIMIT 5
    `);

    const decoratedExecutions = recentExecutions.map(item => ({
      ...item,
      recipient_phone_masked: maskPhone(item.recipient_phone)
    }));

    // WhatsApp status
    const whatsappStatus = whatsappService.getStatus();

    res.json({
      success: true,
      data: {
        whatsapp: whatsappStatus,
        counts: {
          total: scheduleCounts?.total_schedules || 0,
          active: scheduleCounts?.active_schedules || 0,
          paused: scheduleCounts?.paused_schedules || 0,
          successful: executionCounts?.successful_sends || 0,
          failed: executionCounts?.failed_sends || 0,
          uncertain: executionCounts?.uncertain_sends || 0,
          skipped: executionCounts?.skipped_sends || 0,
          todaySent: executionCounts?.today_successful_sends || 0,
          todayFailed: executionCounts?.today_failed_sends || 0,
          todayTotal: executionCounts?.today_total_sends || 0,
          timezone: tz
        },
        nextSchedule: decoratedNextSchedule,
        recentExecutions: decoratedExecutions
      }
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getDashboardStats
};
