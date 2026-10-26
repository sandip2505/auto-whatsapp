import { isValidPhone, normalizePhone } from '../utils/phone.js';
import { isValidTimezone, calculateNextRun } from '../utils/timezone.js';
import { DateTime } from 'luxon';

export function validateSchedulePayload(data, isUpdate = false) {
  const errors = [];
  const sanitized = {};

  // Recipient name (optional)
  if (data.recipient_name !== undefined) {
    sanitized.recipient_name = typeof data.recipient_name === 'string' ? data.recipient_name.trim() : null;
  }

  // Schedule name (optional)
  if (data.name !== undefined) {
    sanitized.name = typeof data.name === 'string' ? data.name.trim() : null;
  }

  // Phone number (required if not update, or if provided)
  if (!isUpdate || data.phone_number !== undefined) {
    const rawPhone = data.phone_number;
    if (!rawPhone || typeof rawPhone !== 'string') {
      errors.push('Phone number is required and must include the country code (e.g. +919876543210).');
    } else {
      const normalized = normalizePhone(rawPhone);
      if (!isValidPhone(normalized)) {
        errors.push('Invalid phone number. Format must be E.164 with international dial code, e.g. +919876543210.');
      } else {
        sanitized.phone_number = normalized;
      }
    }
  }

  // Message (required if not update, or if provided)
  if (!isUpdate || data.message !== undefined) {
    if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
      errors.push('Message text is required and cannot be empty.');
    } else if (data.message.length > 4096) {
      errors.push('Message text cannot exceed 4096 characters.');
    } else {
      sanitized.message = data.message.trim();
    }
  }

  // Schedule type
  const validTypes = ['one_time', 'interval', 'every_10_minutes', 'daily', 'weekly', 'monthly'];
  if (!isUpdate || data.schedule_type !== undefined) {
    if (!data.schedule_type || !validTypes.includes(data.schedule_type)) {
      errors.push(`Schedule type must be one of: ${validTypes.join(', ')}.`);
    } else {
      sanitized.schedule_type = data.schedule_type;
    }
  }

  // Timezone
  const tz = data.timezone || 'Asia/Kolkata';
  if (!isValidTimezone(tz)) {
    errors.push(`Invalid timezone "${tz}". Must be a valid IANA timezone (e.g. "Asia/Kolkata", "America/New_York").`);
  } else {
    sanitized.timezone = tz;
  }

  // Enabled / status
  if (data.enabled !== undefined) {
    sanitized.enabled = data.enabled ? 1 : 0;
  } else if (!isUpdate) {
    sanitized.enabled = 1;
  }

  if (data.status !== undefined) {
    sanitized.status = data.status;
  } else if (!isUpdate) {
    sanitized.status = sanitized.enabled ? 'active' : 'paused';
  }

  function parseAutoIncrementConfig(rc, rawData) {
    let cfg = rc;
    if (typeof cfg === 'string') {
      try {
        cfg = JSON.parse(cfg);
      } catch {
        cfg = {};
      }
    } else if (!cfg || typeof cfg !== 'object') {
      cfg = {};
    }

    const autoIncRaw = cfg.autoIncrement !== undefined ? cfg.autoIncrement : rawData?.autoIncrement;
    const autoIncrement = Boolean(autoIncRaw === true || autoIncRaw === 'true' || autoIncRaw === 1 || autoIncRaw === '1');

    let startCount = 1;
    const startRaw = cfg.startCount !== undefined ? cfg.startCount : rawData?.startCount;
    if (startRaw !== undefined && startRaw !== null && startRaw !== '') {
      const parsed = parseInt(startRaw, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        startCount = parsed;
      }
    }

    let currentCount = startCount;
    const currentRaw = cfg.currentCount !== undefined ? cfg.currentCount : rawData?.currentCount;
    if (currentRaw !== undefined && currentRaw !== null && currentRaw !== '') {
      const parsed = parseInt(currentRaw, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        currentCount = parsed;
      }
    }

    return { autoIncrement, startCount, currentCount };
  }

  // One-time specific validation
  if (sanitized.schedule_type === 'one_time') {
    if (!data.scheduled_at_utc) {
      errors.push('Scheduled date and time (scheduled_at_utc) is required for one-time messages.');
    } else {
      const scheduledDt = DateTime.fromISO(data.scheduled_at_utc, { zone: 'utc' });
      if (!scheduledDt.isValid) {
        errors.push('Invalid scheduled date/time ISO string.');
      } else if (!isUpdate && scheduledDt <= DateTime.utc()) {
        errors.push('Scheduled time for a new one-time message must be in the future.');
      } else {
        sanitized.scheduled_at_utc = scheduledDt.toISO();
      }
    }

    const autoInc = parseAutoIncrementConfig(data.recurrence_config, data);
    sanitized.recurrence_config = autoInc.autoIncrement ? JSON.stringify(autoInc) : null;
  }

  // Interval specific validation
  if (['interval', 'every_10_minutes'].includes(sanitized.schedule_type)) {
    let rConfig = data.recurrence_config || {};
    if (typeof rConfig === 'string') {
      try {
        rConfig = JSON.parse(rConfig);
      } catch {
        errors.push('Invalid JSON format in recurrence_config.');
        rConfig = {};
      }
    }

    const hours = parseInt(rConfig.intervalHours || '0', 10);
    const mins = parseInt(rConfig.intervalMinutes !== undefined ? rConfig.intervalMinutes : (sanitized.schedule_type === 'every_10_minutes' ? '10' : '0'), 10);
    const secs = parseInt(rConfig.intervalSeconds || '0', 10);

    const totalSeconds = ((isNaN(hours) ? 0 : hours) * 3600) + ((isNaN(mins) ? 0 : mins) * 60) + (isNaN(secs) ? 0 : secs);
    if (totalSeconds < 1) {
      errors.push('Interval must be at least 1 second (specify hours, minutes, and/or seconds).');
    }

    const durRaw = rConfig.durationHours !== undefined ? rConfig.durationHours : data.duration_hours;
    const durNum = durRaw !== undefined && durRaw !== null && durRaw !== '' ? parseFloat(durRaw) : null;
    const durationHours = durNum !== null && !isNaN(durNum) && durNum > 0 ? durNum : null;

    const autoInc = parseAutoIncrementConfig(rConfig, data);

    sanitized.recurrence_config = JSON.stringify({
      intervalHours: isNaN(hours) ? 0 : Math.max(0, hours),
      intervalMinutes: isNaN(mins) ? 0 : Math.max(0, mins),
      intervalSeconds: isNaN(secs) ? 0 : Math.max(0, secs),
      durationHours,
      totalSeconds,
      autoIncrement: autoInc.autoIncrement,
      startCount: autoInc.startCount,
      currentCount: autoInc.currentCount
    });
    sanitized.scheduled_at_utc = null;

    // Start / End boundaries
    if (data.start_at_utc) {
      const startDt = DateTime.fromISO(data.start_at_utc, { zone: 'utc' });
      if (!startDt.isValid) {
        errors.push('Invalid start_at_utc date/time.');
      } else {
        sanitized.start_at_utc = startDt.toISO();
      }
    } else {
      sanitized.start_at_utc = null;
    }

    if (data.end_at_utc) {
      const endDt = DateTime.fromISO(data.end_at_utc, { zone: 'utc' });
      if (!endDt.isValid) {
        errors.push('Invalid end_at_utc date/time.');
      } else {
        sanitized.end_at_utc = endDt.toISO();
        if (sanitized.start_at_utc && endDt <= DateTime.fromISO(sanitized.start_at_utc, { zone: 'utc' })) {
          errors.push('End date must be later than the start date.');
        }
      }
    } else if (durationHours) {
      sanitized.end_at_utc = DateTime.utc().plus({ hours: durationHours }).toISO();
    } else {
      sanitized.end_at_utc = null;
    }
  }

  // Recurring specific validation
  if (['daily', 'weekly', 'monthly'].includes(sanitized.schedule_type)) {
    let rConfig = data.recurrence_config || {};
    if (typeof rConfig === 'string') {
      try {
        rConfig = JSON.parse(rConfig);
      } catch {
        errors.push('Invalid JSON format in recurrence_config.');
        rConfig = {};
      }
    }

    // Validate time 'HH:mm'
    if (!rConfig.time || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(rConfig.time)) {
      errors.push('A valid execution time (HH:mm in 24-hour format) is required for recurring schedules.');
    }

    if (sanitized.schedule_type === 'weekly') {
      if (!Array.isArray(rConfig.weekdays) || rConfig.weekdays.length === 0) {
        errors.push('At least one day of the week (1=Mon ... 7=Sun) must be selected for weekly schedules.');
      } else {
        const invalidDays = rConfig.weekdays.filter(d => !Number.isInteger(d) || d < 1 || d > 7);
        if (invalidDays.length > 0) {
          errors.push('Weekdays must be integers between 1 (Monday) and 7 (Sunday).');
        }
      }
    }

    if (sanitized.schedule_type === 'monthly') {
      const day = parseInt(rConfig.dayOfMonth, 10);
      if (isNaN(day) || day < 1 || day > 31) {
        errors.push('Day of month must be an integer between 1 and 31.');
      }
    }

    const autoInc = parseAutoIncrementConfig(rConfig, data);
    rConfig.autoIncrement = autoInc.autoIncrement;
    rConfig.startCount = autoInc.startCount;
    rConfig.currentCount = autoInc.currentCount;

    sanitized.recurrence_config = JSON.stringify(rConfig);
    sanitized.scheduled_at_utc = null;

    // Start / End boundaries
    if (data.start_at_utc) {
      const startDt = DateTime.fromISO(data.start_at_utc, { zone: 'utc' });
      if (!startDt.isValid) {
        errors.push('Invalid start_at_utc date/time.');
      } else {
        sanitized.start_at_utc = startDt.toISO();
      }
    } else {
      sanitized.start_at_utc = null;
    }

    if (data.end_at_utc) {
      const endDt = DateTime.fromISO(data.end_at_utc, { zone: 'utc' });
      if (!endDt.isValid) {
        errors.push('Invalid end_at_utc date/time.');
      } else {
        sanitized.end_at_utc = endDt.toISO();
        if (sanitized.start_at_utc && endDt <= DateTime.fromISO(sanitized.start_at_utc, { zone: 'utc' })) {
          errors.push('End date must be later than the start date.');
        }
      }
    } else {
      sanitized.end_at_utc = null;
    }
  }

  // Pre-calculate next_run_at_utc if valid
  if (errors.length === 0) {
    if (sanitized.enabled && sanitized.status === 'active') {
      try {
        const next = calculateNextRun(sanitized, DateTime.utc());
        sanitized.next_run_at_utc = next;
      } catch (calcErr) {
        errors.push(`Could not calculate next execution: ${calcErr.message}`);
      }
    } else {
      sanitized.next_run_at_utc = null;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: sanitized
  };
}

export default {
  validateSchedulePayload
};
