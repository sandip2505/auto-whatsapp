import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { DateTime } from 'luxon';
import whatsappService from '../src/services/whatsapp.service.js';
import executionService from '../src/services/execution.service.js';
import { getDb, closeDb } from '../src/database/db.js';

describe('Scheduler Engine & Execution Tracking', () => {
  before(async () => {
    // Enable Mock WhatsApp mode for automated tests
    whatsappService.setMockMode(true);
    await whatsappService.initialize();
  });

  after(async () => {
    const db = await getDb();
    await db.run(`DELETE FROM execution_logs WHERE recipient_phone = '+919876543210'`);
    await db.run(`DELETE FROM schedules WHERE phone_number = '+919876543210'`);
    await closeDb();
  });

  it('should persist a schedule in SQLite and survive queries', async () => {
    const db = await getDb();
    const nowUtc = DateTime.utc().toISO();
    const futureUtc = DateTime.utc().plus({ days: 1 }).toISO();

    const insertResult = await db.run(
      `INSERT INTO schedules (
        name, recipient_name, phone_number, message, schedule_type,
        scheduled_at_utc, timezone, next_run_at_utc, enabled, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'one_time', ?, 'Asia/Kolkata', ?, 1, 'active', ?, ?)`,
      ['Test Schedule', 'Test Recipient', '+919876543210', 'Test message content', futureUtc, futureUtc, nowUtc, nowUtc]
    );

    const scheduleId = insertResult.lastID;
    const retrieved = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);

    assert.ok(retrieved);
    assert.strictEqual(retrieved.name, 'Test Schedule');
    assert.strictEqual(retrieved.status, 'active');
  });

  it('should successfully execute a schedule and record accepted execution log', async () => {
    const db = await getDb();
    const nowUtc = DateTime.utc().toISO();

    const insertResult = await db.run(
      `INSERT INTO schedules (
        name, recipient_name, phone_number, message, schedule_type,
        scheduled_at_utc, timezone, next_run_at_utc, enabled, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'one_time', ?, 'Asia/Kolkata', ?, 1, 'active', ?, ?)`,
      ['Integration Test Schedule', 'Test Recipient', '+919876543210', 'Hello Automated Test!', nowUtc, nowUtc, nowUtc, nowUtc]
    );
    const scheduleId = insertResult.lastID;
    const schedule = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);

    // Execute
    const log = await executionService.executeOccurrence(schedule, nowUtc);

    assert.ok(log);
    assert.strictEqual(log.status, 'accepted');
    assert.ok(log.whatsapp_message_id);
    assert.strictEqual(log.recipient_phone, '+919876543210');
  });

  it('should prevent duplicate execution triggers for the exact same occurrence key', async () => {
    const db = await getDb();
    const scheduledTime = DateTime.utc().toISO();

    const insertResult = await db.run(
      `INSERT INTO schedules (
        name, phone_number, message, schedule_type, timezone, recurrence_config,
        next_run_at_utc, enabled, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'daily', 'Asia/Kolkata', ?, ?, 1, 'active', ?, ?)`,
      ['Duplicate Test Schedule', '+919876543210', 'Duplicate Test Msg', JSON.stringify({ time: '09:00' }), scheduledTime, scheduledTime, scheduledTime]
    );
    const scheduleId = insertResult.lastID;
    const schedule = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);

    // First execution
    const firstLog = await executionService.executeOccurrence(schedule, scheduledTime);
    assert.ok(firstLog);
    assert.strictEqual(firstLog.status, 'accepted');

    // Second execution with identical occurrence key must be rejected by uniqueness constraint
    const secondAttempt = await executionService.executeOccurrence(schedule, scheduledTime);
    assert.strictEqual(secondAttempt, null, 'Second execution of same occurrence key must return null');
  });

  it('should record missed occurrences as skipped and advance schedule', async () => {
    const db = await getDb();
    const missedTime = DateTime.utc().minus({ hours: 3 }).toISO();
    const nowUtc = DateTime.utc().toISO();

    const insertResult = await db.run(
      `INSERT INTO schedules (
        name, phone_number, message, schedule_type, timezone, recurrence_config,
        next_run_at_utc, enabled, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'daily', 'Asia/Kolkata', ?, ?, 1, 'active', ?, ?)`,
      ['Missed Schedule', '+919876543210', 'Missed Test Msg', JSON.stringify({ time: '09:00' }), missedTime, nowUtc, nowUtc]
    );
    const scheduleId = insertResult.lastID;
    const schedule = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);

    await executionService.recordSkippedOccurrence(schedule, missedTime, 'Offline missed job');

    const log = await db.get(
      `SELECT * FROM execution_logs WHERE scheduled_occurrence_key = ?`,
      [`occ_${scheduleId}_${missedTime}`]
    );

    assert.ok(log);
    assert.strictEqual(log.status, 'skipped');
    assert.strictEqual(log.error_code, 'MISSED_OCCURRENCE');
  });

  it('should preserve historical execution logs when a schedule is deleted', async () => {
    const db = await getDb();
    const nowUtc = DateTime.utc().toISO();

    // Create schedule
    const insertRes = await db.run(
      `INSERT INTO schedules (
        name, phone_number, message, schedule_type, timezone, enabled, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'daily', 'Asia/Kolkata', 1, 'active', ?, ?)`,
      ['To-be-deleted schedule', '+919876543210', 'Preserve logs test', nowUtc, nowUtc]
    );
    const scheduleId = insertRes.lastID;
    const schedule = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);

    // Execute occurrence
    const log = await executionService.executeOccurrence(schedule, nowUtc);
    assert.ok(log);

    // Delete schedule after unlinking foreign key
    await db.run(`UPDATE execution_logs SET schedule_id = NULL WHERE schedule_id = ?`, [scheduleId]);
    await db.run(`DELETE FROM schedules WHERE id = ?`, [scheduleId]);

    // Check execution log still exists
    const persistedLog = await db.get(`SELECT * FROM execution_logs WHERE id = ?`, [log.id]);
    assert.ok(persistedLog, 'Execution log must remain in database after schedule deletion');
    assert.strictEqual(persistedLog.schedule_name, 'To-be-deleted schedule');
  });

  it('should format auto-increment message and advance counter in database', async () => {
    const db = await getDb();
    const nowUtc = DateTime.utc().toISO();
    const futureUtc = DateTime.utc().plus({ seconds: 30 }).toISO();

    // Create schedule with message "I love you" and autoIncrement enabled
    const insertRes = await db.run(
      `INSERT INTO schedules (
        name, phone_number, message, schedule_type, timezone, recurrence_config,
        next_run_at_utc, enabled, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'interval', 'Asia/Kolkata', ?, ?, 1, 'active', ?, ?)`,
      [
        'Love Counter',
        '+919876543210',
        'I love you',
        JSON.stringify({ intervalSeconds: 30, autoIncrement: true, startCount: 1, currentCount: 1 }),
        futureUtc,
        nowUtc,
        nowUtc
      ]
    );
    const scheduleId = insertRes.lastID;
    let schedule = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);

    // First execution -> should send "I love you 1"
    const log1 = await executionService.executeOccurrence(schedule, nowUtc);
    assert.ok(log1);
    assert.strictEqual(log1.message_snippet, 'I love you 1');

    // Verify counter in database incremented to 2
    schedule = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);
    const configAfter1 = JSON.parse(schedule.recurrence_config);
    assert.strictEqual(configAfter1.currentCount, 2);

    // Second execution -> should send "I love you 2"
    const nextUtc = DateTime.utc().plus({ seconds: 60 }).toISO();
    const log2 = await executionService.executeOccurrence(schedule, nextUtc);
    assert.ok(log2);
    assert.strictEqual(log2.message_snippet, 'I love you 2');

    // Verify counter in database incremented to 3
    schedule = await db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId]);
    const configAfter2 = JSON.parse(schedule.recurrence_config);
    assert.strictEqual(configAfter2.currentCount, 3);
  });
});
