import { getDb } from '../database/db.js';
import logger from './logger.service.js';
import executionService from './execution.service.js';
import { calculateNextRun } from '../utils/timezone.js';
import { DateTime } from 'luxon';

class SchedulerService {
  constructor() {
    this.timer = null;
    this.pollIntervalMs = 1000; // Check database every 1 second for second-level precision
    this.isRunning = false;
    this.isProcessingTick = false;
  }

  /**
   * Starts the scheduling engine and processes overdue startup jobs.
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('scheduler', 'Starting scheduler engine...');

    try {
      await this.handleStartupMissedJobs();
      await this.recalculateAllActiveSchedules();
    } catch (err) {
      logger.error('scheduler', `Error during scheduler startup routines: ${err.message}`);
    }

    this.timer = setInterval(() => {
      this.tick().catch(err => {
        logger.error('scheduler', `Scheduler tick failed: ${err.message}`);
      });
    }, this.pollIntervalMs);

    logger.info('scheduler', `Scheduler engine active (polling every ${this.pollIntervalMs / 1000}s).`);
  }

  /**
   * Inspects database for overdue jobs on application startup.
   */
  async handleStartupMissedJobs() {
    const db = await getDb();
    const nowUtc = DateTime.utc().toISO();

    // Query missed job policy setting
    const policyRow = await db.get(`SELECT value FROM settings WHERE key = 'missed_job_policy'`);
    const policy = policyRow ? policyRow.value : 'skip';

    logger.info('scheduler', `Checking for missed jobs while offline... Policy: "${policy}"`);

    const overdueSchedules = await db.all(
      `SELECT * FROM schedules 
       WHERE enabled = 1 
         AND status = 'active' 
         AND next_run_at_utc IS NOT NULL 
         AND next_run_at_utc < ?`,
      [nowUtc]
    );

    if (overdueSchedules.length === 0) {
      logger.info('scheduler', 'No overdue jobs found upon startup.');
      return;
    }

    logger.warn('scheduler', `Found ${overdueSchedules.length} overdue schedule(s) missed while offline.`);

    for (const schedule of overdueSchedules) {
      const missedTime = schedule.next_run_at_utc;
      if (policy === 'skip') {
        await executionService.recordSkippedOccurrence(
          schedule,
          missedTime,
          'Scheduled occurrence was missed while application was offline. Skipped per missed-job policy.'
        );
      } else {
        logger.warn('scheduler', `Schedule #${schedule.id} overdue. Left for manual retry per policy.`);
        // Advance schedule so it doesn't get stuck in the past
        const nextFuture = calculateNextRun(schedule, DateTime.utc());
        await db.run(
          `UPDATE schedules SET next_run_at_utc = ?, updated_at = ? WHERE id = ?`,
          [nextFuture, nowUtc, schedule.id]
        );
      }
    }
  }

  /**
   * Recalculates and updates next_run_at_utc for all enabled active schedules.
   */
  async recalculateAllActiveSchedules() {
    const db = await getDb();
    const schedules = await db.all(
      `SELECT * FROM schedules WHERE enabled = 1 AND status = 'active'`
    );

    const now = DateTime.utc();
    for (const schedule of schedules) {
      const nextRun = calculateNextRun(schedule, now);
      if (schedule.next_run_at_utc !== nextRun) {
        await db.run(
          `UPDATE schedules SET next_run_at_utc = ?, updated_at = ? WHERE id = ?`,
          [nextRun, now.toISO(), schedule.id]
        );
      }
    }
  }

  /**
   * Periodic scheduler tick: checks for schedules due to run.
   */
  async tick() {
    if (!this.isRunning || this.isProcessingTick) return;
    this.isProcessingTick = true;

    try {
      const db = await getDb();
      const nowUtc = DateTime.utc().toISO();

      // Find due schedules
      const dueSchedules = await db.all(
        `SELECT * FROM schedules 
         WHERE enabled = 1 
           AND status = 'active' 
           AND next_run_at_utc IS NOT NULL 
           AND next_run_at_utc <= ?
         ORDER BY next_run_at_utc ASC`,
        [nowUtc]
      );

      for (const schedule of dueSchedules) {
        const scheduledTime = schedule.next_run_at_utc;
        // Fire asynchronously so slow execution does not block other due schedules
        executionService.executeOccurrence(schedule, scheduledTime).catch(err => {
          logger.error('scheduler', `Error executing schedule #${schedule.id}: ${err.message}`);
        });
      }
    } catch (err) {
      logger.error('scheduler', `Scheduler tick query error: ${err.message}`);
    } finally {
      this.isProcessingTick = false;
    }
  }

  /**
   * Called whenever a schedule is created or edited to immediately update its next_run_at_utc.
   * @param {number} scheduleId 
   */
  async refreshSchedule(scheduleId) {
    const db = await getDb();
    const schedule = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);
    if (!schedule) return;

    if (!schedule.enabled || schedule.status !== 'active') {
      await db.run(`UPDATE schedules SET next_run_at_utc = NULL WHERE id = ?`, [scheduleId]);
      return;
    }

    const nextRun = calculateNextRun(schedule, DateTime.utc());
    await db.run(
      `UPDATE schedules SET next_run_at_utc = ?, updated_at = ? WHERE id = ?`,
      [nextRun, DateTime.utc().toISO(), scheduleId]
    );
  }

  /**
   * Stops the scheduler.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('scheduler', 'Scheduler engine stopped.');
  }
}

export const schedulerService = new SchedulerService();
export default schedulerService;
