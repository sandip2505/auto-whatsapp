import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DateTime } from 'luxon';
import { validateSchedulePayload } from '../src/validators/schedule.validator.js';
import { isValidPhone, normalizePhone, maskPhone } from '../src/utils/phone.js';

describe('Phone Number Utilities', () => {
  it('should validate E.164 phone numbers with country code', () => {
    assert.strictEqual(isValidPhone('+919876543210'), true);
    assert.strictEqual(isValidPhone('+14155552671'), true);
    assert.strictEqual(isValidPhone('9876543210'), false); // Missing leading +
    assert.strictEqual(isValidPhone('+01234567'), false); // Country code cannot start with 0
    assert.strictEqual(isValidPhone('+91abc'), false);
    assert.strictEqual(isValidPhone(''), false);
  });

  it('should normalize phone numbers with spaces, dashes or parens', () => {
    assert.strictEqual(normalizePhone('+91 98765-43210'), '+919876543210');
    assert.strictEqual(normalizePhone('+1 (415) 555-2671'), '+14155552671');
  });

  it('should mask phone numbers for privacy', () => {
    assert.strictEqual(maskPhone('+919876543210'), '+9198****3210');
  });
});

describe('Schedule Payload Validator', () => {
  it('should reject schedule with missing or invalid phone number', () => {
    const res = validateSchedulePayload({
      phone_number: 'invalid',
      message: 'Hello',
      schedule_type: 'daily',
      recurrence_config: { time: '09:00' }
    });

    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('Invalid phone number')));
  });

  it('should reject schedule with empty message', () => {
    const res = validateSchedulePayload({
      phone_number: '+919876543210',
      message: '   ',
      schedule_type: 'daily',
      recurrence_config: { time: '09:00' }
    });

    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('Message text is required')));
  });

  it('should reject past one_time schedules on creation', () => {
    const pastTime = DateTime.utc().minus({ hours: 2 }).toISO();
    const res = validateSchedulePayload({
      phone_number: '+919876543210',
      message: 'Hello',
      schedule_type: 'one_time',
      scheduled_at_utc: pastTime
    });

    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('must be in the future')));
  });

  it('should validate and accept a valid daily schedule', () => {
    const res = validateSchedulePayload({
      recipient_name: 'Friend',
      phone_number: '+91 98765 43210',
      message: 'Hello daily test!',
      schedule_type: 'daily',
      timezone: 'Asia/Kolkata',
      recurrence_config: { time: '14:30' }
    });

    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.data.phone_number, '+919876543210');
    assert.strictEqual(res.data.status, 'active');
    assert.ok(res.data.next_run_at_utc);
  });

  it('should validate and accept a valid every_10_minutes schedule', () => {
    const res = validateSchedulePayload({
      recipient_name: 'Reminder Bot',
      phone_number: '+91 98765 43210',
      message: 'Take a sip of water!',
      schedule_type: 'every_10_minutes',
      timezone: 'Asia/Kolkata'
    });

    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.data.schedule_type, 'every_10_minutes');
    assert.strictEqual(res.data.phone_number, '+919876543210');
    assert.ok(res.data.next_run_at_utc);
  });

  it('should validate and accept a valid interval schedule with custom hours and minutes', () => {
    const res = validateSchedulePayload({
      recipient_name: 'Interval Bot',
      phone_number: '+91 98765 43210',
      message: 'Time to drink water!',
      schedule_type: 'interval',
      timezone: 'Asia/Kolkata',
      recurrence_config: { intervalHours: 1, intervalMinutes: 30 }
    });

    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.data.schedule_type, 'interval');
    assert.strictEqual(res.data.phone_number, '+919876543210');
    assert.ok(res.data.next_run_at_utc);
  });

  it('should reject interval schedule with 0 hours, 0 minutes, and 0 seconds', () => {
    const res = validateSchedulePayload({
      recipient_name: 'Interval Bot',
      phone_number: '+91 98765 43210',
      message: 'Zero test',
      schedule_type: 'interval',
      timezone: 'Asia/Kolkata',
      recurrence_config: { intervalHours: 0, intervalMinutes: 0, intervalSeconds: 0 }
    });

    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('Interval must be at least 1 second')));
  });

  it('should validate and accept interval schedule with seconds', () => {
    const res = validateSchedulePayload({
      recipient_name: 'Interval Bot',
      phone_number: '+91 98765 43210',
      message: 'Seconds test',
      schedule_type: 'interval',
      timezone: 'Asia/Kolkata',
      recurrence_config: { intervalHours: 0, intervalMinutes: 0, intervalSeconds: 30 }
    });

    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.data.schedule_type, 'interval');
  });

  it('should calculate end_at_utc when durationHours is specified in interval', () => {
    const res = validateSchedulePayload({
      recipient_name: 'Interval Bot',
      phone_number: '+91 98765 43210',
      message: 'Duration test',
      schedule_type: 'interval',
      timezone: 'Asia/Kolkata',
      recurrence_config: { intervalHours: 0, intervalMinutes: 1, intervalSeconds: 0, durationHours: 2 }
    });

    assert.strictEqual(res.isValid, true);
    assert.ok(res.data.end_at_utc, 'end_at_utc should be generated from durationHours');
  });

  it('should reject weekly schedule with no weekdays selected', () => {
    const res = validateSchedulePayload({
      phone_number: '+919876543210',
      message: 'Hello',
      schedule_type: 'weekly',
      recurrence_config: { time: '10:00', weekdays: [] }
    });

    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('At least one day of the week')));
  });

  it('should validate and parse autoIncrement settings in recurrence_config', () => {
    const res = validateSchedulePayload({
      recipient_name: 'Counter Bot',
      phone_number: '+91 98765 43210',
      message: 'I love you',
      schedule_type: 'interval',
      timezone: 'Asia/Kolkata',
      recurrence_config: {
        intervalSeconds: 30,
        autoIncrement: true,
        startCount: 5
      }
    });

    assert.strictEqual(res.isValid, true);
    const parsedConfig = JSON.parse(res.data.recurrence_config);
    assert.strictEqual(parsedConfig.autoIncrement, true);
    assert.strictEqual(parsedConfig.startCount, 5);
    assert.strictEqual(parsedConfig.currentCount, 5);
  });
});
