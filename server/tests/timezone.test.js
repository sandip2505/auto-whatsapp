import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DateTime } from 'luxon';
import {
  isValidTimezone,
  toUtcIso,
  formatInTimezone,
  calculateNextRun,
  getHumanSummary
} from '../src/utils/timezone.js';

describe('Timezone & Recurrence Utilities', () => {
  it('should validate IANA timezone identifiers correctly', () => {
    assert.strictEqual(isValidTimezone('Asia/Kolkata'), true);
    assert.strictEqual(isValidTimezone('America/New_York'), true);
    assert.strictEqual(isValidTimezone('UTC'), true);
    assert.strictEqual(isValidTimezone('Invalid/Zone'), false);
    assert.strictEqual(isValidTimezone(''), false);
    assert.strictEqual(isValidTimezone(null), false);
  });

  it('should accurately convert local date/time in Asia/Kolkata (+05:30) to UTC', () => {
    // 2026-10-23 09:00:00 IST is 2026-10-23 03:30:00Z
    const utcIso = toUtcIso('2026-10-23', '09:00', 'Asia/Kolkata');
    assert.strictEqual(utcIso, '2026-10-23T03:30:00.000Z');
  });

  it('should calculate next run for a future one_time schedule', () => {
    const futureUtc = DateTime.utc().plus({ days: 2 }).toISO();
    const schedule = {
      schedule_type: 'one_time',
      scheduled_at_utc: futureUtc,
      timezone: 'Asia/Kolkata'
    };

    const nextRun = calculateNextRun(schedule);
    assert.strictEqual(nextRun, futureUtc);
  });

  it('should return null for a past one_time schedule', () => {
    const pastUtc = DateTime.utc().minus({ hours: 1 }).toISO();
    const schedule = {
      schedule_type: 'one_time',
      scheduled_at_utc: pastUtc,
      timezone: 'Asia/Kolkata'
    };

    const nextRun = calculateNextRun(schedule);
    assert.strictEqual(nextRun, null);
  });

  it('should compute next daily run correctly', () => {
    // Reference time: 10:00 AM IST
    const fromDt = DateTime.fromISO('2026-10-23T04:30:00.000Z', { zone: 'utc' }); // 10:00 IST
    
    // Scheduled for 11:00 AM IST (later today)
    const scheduleLaterToday = {
      schedule_type: 'daily',
      timezone: 'Asia/Kolkata',
      recurrence_config: JSON.stringify({ time: '11:00' })
    };
    const next1 = calculateNextRun(scheduleLaterToday, fromDt);
    assert.strictEqual(next1, '2026-10-23T05:30:00.000Z'); // 11:00 IST today

    // Scheduled for 09:00 AM IST (already passed today -> should be tomorrow)
    const scheduleTomorrow = {
      schedule_type: 'daily',
      timezone: 'Asia/Kolkata',
      recurrence_config: JSON.stringify({ time: '09:00' })
    };
    const next2 = calculateNextRun(scheduleTomorrow, fromDt);
    assert.strictEqual(next2, '2026-10-24T03:30:00.000Z'); // 09:00 IST tomorrow
  });

  it('should compute next weekly run on selected weekdays', () => {
    // 2026-10-23 is Friday (weekday = 5) at 10:00 AM IST
    const fromDt = DateTime.fromISO('2026-10-23T04:30:00.000Z', { zone: 'utc' });

    // Weekly schedule on Mon (1) and Wed (3) at 09:00 AM IST
    // Next occurrence should be next Monday (2026-10-26) at 03:30Z
    const schedule = {
      schedule_type: 'weekly',
      timezone: 'Asia/Kolkata',
      recurrence_config: JSON.stringify({ time: '09:00', weekdays: [1, 3] })
    };

    const next = calculateNextRun(schedule, fromDt);
    const nextLocal = DateTime.fromISO(next, { zone: 'utc' }).setZone('Asia/Kolkata');
    assert.strictEqual(nextLocal.weekday, 1); // Monday
    assert.strictEqual(nextLocal.toFormat('yyyy-MM-dd HH:mm'), '2026-10-26 09:00');
  });

  it('should compute next run for every_10_minutes accurately to next 10-minute clock mark', () => {
    // 2026-10-23 at 11:43:25 AM IST (06:13:25 UTC)
    const fromDt = DateTime.fromISO('2026-10-23T06:13:25.000Z', { zone: 'utc' });
    const schedule = {
      schedule_type: 'every_10_minutes',
      timezone: 'Asia/Kolkata'
    };

    const next = calculateNextRun(schedule, fromDt);
    const nextLocal = DateTime.fromISO(next, { zone: 'utc' }).setZone('Asia/Kolkata');
    // Next 10-minute mark from 11:43 is 11:50:00
    assert.strictEqual(nextLocal.toFormat('HH:mm:ss'), '11:50:00');

    // From 11:50:00, next should be 12:00:00
    const fromDtBoundary = DateTime.fromISO(next, { zone: 'utc' });
    const nextAfterBoundary = calculateNextRun(schedule, fromDtBoundary);
    const nextAfterLocal = DateTime.fromISO(nextAfterBoundary, { zone: 'utc' }).setZone('Asia/Kolkata');
    assert.strictEqual(nextAfterLocal.toFormat('HH:mm:ss'), '12:00:00');
  });

  it('should compute next monthly run with day-clamping', () => {
    // 2026-02-15 at 10:00 AM IST. Monthly schedule on 31st of each month.
    // In February (non-leap year has 28 days), it should clamp to 28th Feb.
    const fromDt = DateTime.fromISO('2026-02-15T04:30:00.000Z', { zone: 'utc' });
    const schedule = {
      schedule_type: 'monthly',
      timezone: 'Asia/Kolkata',
      recurrence_config: JSON.stringify({ time: '10:00', dayOfMonth: 31 })
    };

    const next = calculateNextRun(schedule, fromDt);
    const nextLocal = DateTime.fromISO(next, { zone: 'utc' }).setZone('Asia/Kolkata');
    assert.strictEqual(nextLocal.toFormat('yyyy-MM-dd'), '2026-02-28');
  });

  it('should respect end_at_utc boundary', () => {
    const fromDt = DateTime.fromISO('2026-10-23T04:30:00.000Z', { zone: 'utc' });
    const schedule = {
      schedule_type: 'daily',
      timezone: 'Asia/Kolkata',
      recurrence_config: JSON.stringify({ time: '09:00' }),
      // End boundary is today at 12:00 UTC (before tomorrow's 09:00 IST)
      end_at_utc: '2026-10-23T12:00:00.000Z'
    };

    const next = calculateNextRun(schedule, fromDt);
    assert.strictEqual(next, null); // Beyond end date
  });

  it('should compute next run for custom interval (hours and minutes) accurately', () => {
    // 2026-10-23 at 10:00:00 AM IST (04:30:00 UTC)
    const fromDt = DateTime.fromISO('2026-10-23T04:30:00.000Z', { zone: 'utc' });
    const schedule = {
      schedule_type: 'interval',
      timezone: 'Asia/Kolkata',
      recurrence_config: JSON.stringify({ intervalHours: 1, intervalMinutes: 30 })
    };

    const next = calculateNextRun(schedule, fromDt);
    const nextLocal = DateTime.fromISO(next, { zone: 'utc' }).setZone('Asia/Kolkata');
    // 10:00 + 1 hr 30 min = 11:30:00 IST
    assert.strictEqual(nextLocal.toFormat('HH:mm:ss'), '11:30:00');

    // Next after 11:30:00 IST should be 13:00:00 IST (1:00 PM)
    const next2 = calculateNextRun(schedule, DateTime.fromISO(next, { zone: 'utc' }));
    const next2Local = DateTime.fromISO(next2, { zone: 'utc' }).setZone('Asia/Kolkata');
    assert.strictEqual(next2Local.toFormat('HH:mm:ss'), '13:00:00');
  });

  it('should compute next run for custom interval with seconds accurately', () => {
    // 2026-10-23 at 10:00:00 AM IST (04:30:00 UTC)
    const fromDt = DateTime.fromISO('2026-10-23T04:30:00.000Z', { zone: 'utc' });
    const schedule = {
      schedule_type: 'interval',
      timezone: 'Asia/Kolkata',
      recurrence_config: JSON.stringify({ intervalHours: 0, intervalMinutes: 0, intervalSeconds: 45 })
    };

    const next = calculateNextRun(schedule, fromDt);
    const nextLocal = DateTime.fromISO(next, { zone: 'utc' }).setZone('Asia/Kolkata');
    // 10:00:00 + 45s = 10:00:45 IST
    assert.strictEqual(nextLocal.toFormat('HH:mm:ss'), '10:00:45');
  });

  it('should generate meaningful human summary strings for interval schedules with seconds', () => {
    const summary = getHumanSummary({
      schedule_type: 'interval',
      timezone: 'Asia/Kolkata',
      recipient_name: 'Alerts',
      phone_number: '+919876543210',
      message: 'Quick ping',
      recurrence_config: JSON.stringify({ intervalHours: 0, intervalMinutes: 1, intervalSeconds: 30, durationHours: 4 })
    });

    assert.match(summary, /every 1 min 30 sec/);
    assert.match(summary, /Active for 4 hours/);
  });

  it('should generate meaningful human summary strings', () => {
    const summary = getHumanSummary({
      schedule_type: 'daily',
      timezone: 'Asia/Kolkata',
      recipient_name: 'Mom',
      phone_number: '+919876543210',
      message: 'Good morning!',
      recurrence_config: JSON.stringify({ time: '09:00' })
    });

    assert.match(summary, /Send "Good morning!" to Mom \(\+919876543210\) every day at 09:00 AM/);
  });
});

