import { getDb } from '../database/db.js';
import logger from './logger.service.js';
import whatsappService from './whatsapp.service.js';
import { maskPhone } from '../utils/phone.js';
import { calculateNextRun } from '../utils/timezone.js';
import { DateTime } from 'luxon';

// In-memory set to prevent concurrent execution of the same schedule
const activeRunningSchedules = new Set();

class ExecutionService {
  /**
   * Executes a scheduled message occurrence.
   * @param {Object} schedule - The schedule record from SQLite
   * @param {string} scheduledAtUtc - The intended scheduled time in UTC ISO format
   * @param {boolean} [isRetry=false] - Whether this is a manual retry
   * @returns {Promise<Object>} Execution result log
   */
  async executeOccurrence(schedule, scheduledAtUtc, isRetry = false) {
    const scheduleId = schedule.id;

    // Concurrency lock: Prevent overlapping executions of the same schedule
    if (activeRunningSchedules.has(scheduleId)) {
      logger.warn('scheduler', `Schedule #${scheduleId} is already executing. Skipping overlapping trigger.`);
      return null;
    }

    activeRunningSchedules.add(scheduleId);
    const db = await getDb();
    const nowUtc = DateTime.utc().toISO();
    const occurrenceKey = `occ_${scheduleId}_${scheduledAtUtc}`;
    const masked = maskPhone(schedule.phone_number);

    // Parse recurrence config for autoIncrement
    let recurrenceConfig = {};
    if (typeof schedule.recurrence_config === 'string') {
      try {
        recurrenceConfig = JSON.parse(schedule.recurrence_config || '{}');
      } catch {
        recurrenceConfig = {};
      }
    } else if (schedule.recurrence_config && typeof schedule.recurrence_config === 'object') {
      recurrenceConfig = { ...schedule.recurrence_config };
    }

    let finalMessage = schedule.message;
    let nextRecurrenceConfig = null;

    if (recurrenceConfig && recurrenceConfig.autoIncrement) {
      let currentCount = parseInt(
        recurrenceConfig.currentCount !== undefined
          ? recurrenceConfig.currentCount
          : (recurrenceConfig.startCount !== undefined ? recurrenceConfig.startCount : 1),
        10
      );
      if (isNaN(currentCount)) {
        currentCount = 1;
      }

      const countRegex = /\{count\}|\{n\}|\{\{count\}\}|\{\{n\}\}/gi;
      if (countRegex.test(finalMessage)) {
        finalMessage = finalMessage.replace(countRegex, String(currentCount));
      } else {
        finalMessage = `${finalMessage.trimEnd()} ${currentCount}`;
      }

      if (!isRetry) {
        nextRecurrenceConfig = {
          ...recurrenceConfig,
          currentCount: currentCount + 1
        };
      }
    }

    const snippet = finalMessage.length > 50 ? `${finalMessage.substring(0, 50)}...` : finalMessage;
    const scheduleName = schedule.name || 'Untitled Schedule';

    let executionLogId = null;

    try {
      if (isRetry) {
        // Create a new retry occurrence key to preserve historical attempt records
        const retryKey = `retry_${scheduleId}_${Date.now()}`;
        const insertResult = await db.run(
          `INSERT INTO execution_logs (
            schedule_id, schedule_name, scheduled_occurrence_key, scheduled_at_utc,
            attempted_at_utc, status, recipient_phone, message_snippet, created_at
          ) VALUES (?, ?, ?, ?, ?, 'sending', ?, ?, ?)`,
          [scheduleId, scheduleName, retryKey, scheduledAtUtc, nowUtc, schedule.phone_number, snippet, nowUtc]
        );
        executionLogId = insertResult.lastID;
      } else {
        // Enforce database-level uniqueness to prevent duplicate execution records
        try {
          const insertResult = await db.run(
            `INSERT INTO execution_logs (
              schedule_id, schedule_name, scheduled_occurrence_key, scheduled_at_utc,
              attempted_at_utc, status, recipient_phone, message_snippet, created_at
            ) VALUES (?, ?, ?, ?, ?, 'sending', ?, ?, ?)`,
            [scheduleId, scheduleName, occurrenceKey, scheduledAtUtc, nowUtc, schedule.phone_number, snippet, nowUtc]
          );
          executionLogId = insertResult.lastID;
        } catch (dbErr) {
          if (dbErr.message && dbErr.message.includes('UNIQUE constraint failed')) {
            logger.warn('scheduler', `Occurrence key ${occurrenceKey} already recorded. Aborting duplicate send attempt.`);
            return null;
          }
          throw dbErr;
        }
      }

      logger.info('scheduler', `Executing schedule #${scheduleId} ("${scheduleName}") for ${masked}...`);

      // Attempt sending via WhatsApp Service
      const sendResult = await whatsappService.sendMessage(schedule.phone_number, finalMessage);
      const finishedUtc = DateTime.utc().toISO();

      if (sendResult.success) {
        // WhatsApp accepted the message
        await db.run(
          `UPDATE execution_logs SET
            status = 'accepted',
            finished_at_utc = ?,
            whatsapp_message_id = ?
          WHERE id = ?`,
          [finishedUtc, sendResult.messageId || null, executionLogId]
        );

        logger.info('scheduler', `Schedule #${scheduleId} successfully dispatched. Message ID: ${sendResult.messageId}`);
      } else if (sendResult.uncertain) {
        // Delivery outcome is uncertain (e.g. socket timeout after message dispatch)
        await db.run(
          `UPDATE execution_logs SET
            status = 'uncertain',
            finished_at_utc = ?,
            error_code = 'DELIVERY_UNCERTAIN',
            error_message = ?
          WHERE id = ?`,
          [finishedUtc, sendResult.error, executionLogId]
        );

        logger.error('scheduler', `Schedule #${scheduleId} ended with UNCERTAIN outcome. No automatic retry will be performed.`);
      } else {
        // Definite failure (e.g. invalid number or WhatsApp disconnected)
        await db.run(
          `UPDATE execution_logs SET
            status = 'failed',
            finished_at_utc = ?,
            error_code = 'SEND_FAILED',
            error_message = ?
          WHERE id = ?`,
          [finishedUtc, sendResult.error, executionLogId]
        );

        logger.error('scheduler', `Schedule #${scheduleId} failed to send: ${sendResult.error}`);
      }

      // Advance schedule or mark completed
      await this._advanceSchedule(schedule, nextRecurrenceConfig);

      return await db.get(`SELECT * FROM execution_logs WHERE id = ?`, [executionLogId]);
    } catch (err) {
      logger.error('scheduler', `Unexpected error during schedule #${scheduleId} execution: ${err.message}`);
      if (executionLogId) {
        await db.run(
          `UPDATE execution_logs SET
            status = 'failed',
            finished_at_utc = ?,
            error_code = 'INTERNAL_ERROR',
            error_message = ?
          WHERE id = ?`,
          [DateTime.utc().toISO(), err.message, executionLogId]
        );
      }
      return null;
    } finally {
      activeRunningSchedules.delete(scheduleId);
    }
  }

  /**
   * Advances the schedule's next_run_at_utc, or marks it completed if one-time.
   */
  async _advanceSchedule(schedule, updatedRecurrenceConfig = null) {
    const db = await getDb();
    const now = DateTime.utc();
    const updatedConfigJson = updatedRecurrenceConfig ? JSON.stringify(updatedRecurrenceConfig) : null;
    if (updatedConfigJson) {
      schedule.recurrence_config = updatedConfigJson;
    }

    if (schedule.schedule_type === 'one_time') {
      if (updatedConfigJson) {
        await db.run(
          `UPDATE schedules SET status = 'completed', enabled = 0, recurrence_config = ?, updated_at = ? WHERE id = ?`,
          [updatedConfigJson, now.toISO(), schedule.id]
        );
      } else {
        await db.run(
          `UPDATE schedules SET status = 'completed', enabled = 0, updated_at = ? WHERE id = ?`,
          [now.toISO(), schedule.id]
        );
      }
      logger.info('scheduler', `One-time schedule #${schedule.id} completed.`);
      return;
    }

    // For recurring schedules, compute the next occurrence
    const nextRun = calculateNextRun(schedule, now);
    if (nextRun) {
      if (updatedConfigJson) {
        await db.run(
          `UPDATE schedules SET next_run_at_utc = ?, recurrence_config = ?, updated_at = ? WHERE id = ?`,
          [nextRun, updatedConfigJson, now.toISO(), schedule.id]
        );
      } else {
        await db.run(
          `UPDATE schedules SET next_run_at_utc = ?, updated_at = ? WHERE id = ?`,
          [nextRun, now.toISO(), schedule.id]
        );
      }
      logger.info('scheduler', `Schedule #${schedule.id} advanced to next occurrence: ${nextRun}`);
    } else {
      // Reached end date
      if (updatedConfigJson) {
        await db.run(
          `UPDATE schedules SET status = 'completed', enabled = 0, next_run_at_utc = NULL, recurrence_config = ?, updated_at = ? WHERE id = ?`,
          [updatedConfigJson, now.toISO(), schedule.id]
        );
      } else {
        await db.run(
          `UPDATE schedules SET status = 'completed', enabled = 0, next_run_at_utc = NULL, updated_at = ? WHERE id = ?`,
          [now.toISO(), schedule.id]
        );
      }
      logger.info('scheduler', `Recurring schedule #${schedule.id} reached end date and was marked completed.`);
    }
  }

  /**
   * Records an overdue occurrence as 'skipped' during startup or pause.
   */
  async recordSkippedOccurrence(schedule, missedTimeUtc, reason = 'Missed while application was offline.') {
    const db = await getDb();
    const nowUtc = DateTime.utc().toISO();
    const occurrenceKey = `occ_${schedule.id}_${missedTimeUtc}`;
    const snippet = schedule.message.length > 50 ? `${schedule.message.substring(0, 50)}...` : schedule.message;
    const scheduleName = schedule.name || 'Untitled Schedule';

    try {
      await db.run(
        `INSERT OR IGNORE INTO execution_logs (
          schedule_id, schedule_name, scheduled_occurrence_key, scheduled_at_utc,
          attempted_at_utc, finished_at_utc, status, recipient_phone,
          message_snippet, error_code, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'skipped', ?, ?, 'MISSED_OCCURRENCE', ?, ?)`,
        [
          schedule.id,
          scheduleName,
          occurrenceKey,
          missedTimeUtc,
          nowUtc,
          nowUtc,
          schedule.phone_number,
          snippet,
          reason,
          nowUtc
        ]
      );

      logger.warn('scheduler', `Schedule #${schedule.id} missed occurrence at ${missedTimeUtc} marked as skipped.`);
      await this._advanceSchedule(schedule);
    } catch (err) {
      logger.error('scheduler', `Failed to record skipped occurrence for schedule #${schedule.id}: ${err.message}`);
    }
  }
}

export const executionService = new ExecutionService();
export default executionService;
