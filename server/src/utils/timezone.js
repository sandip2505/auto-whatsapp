import { DateTime, IANAZone } from 'luxon';

/**
 * Validates whether an IANA timezone identifier is valid.
 * @param {string} tz - e.g. 'Asia/Kolkata', 'America/New_York'
 * @returns {boolean}
 */
export function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  return IANAZone.isValidZone(tz);
}

/**
 * Converts a date and time string in a specified timezone to UTC ISO string.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - 'HH:mm' or 'HH:mm:ss'
 * @param {string} timezone - e.g. 'Asia/Kolkata'
 * @returns {string} ISO UTC string
 */
export function toUtcIso(dateStr, timeStr, timezone = 'Asia/Kolkata') {
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  const dt = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone: timezone }
  );

  if (!dt.isValid) {
    throw new Error(`Invalid date/time combination: ${dt.invalidExplanation}`);
  }

  return dt.toUTC().toISO();
}

/**
 * Formats a UTC ISO string in the target timezone for display.
 * @param {string} utcIso - UTC ISO string
 * @param {string} timezone - Target timezone
 * @param {string} formatStr - Luxon format string
 * @returns {string}
 */
export function formatInTimezone(utcIso, timezone = 'Asia/Kolkata', formatStr = 'yyyy-MM-dd HH:mm:ss ZZZZ') {
  if (!utcIso) return '';
  const dt = DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(timezone);
  return dt.isValid ? dt.toFormat(formatStr) : '';
}

/**
 * Calculates the next run time in UTC for a schedule.
 * @param {Object} schedule - Schedule object
 * @param {DateTime} [fromDt] - Starting DateTime in UTC (defaults to DateTime.utc())
 * @returns {string|null} Next run ISO string in UTC, or null if schedule is completed/expired.
 */
export function calculateNextRun(schedule, fromDt = DateTime.utc()) {
  const tz = schedule.timezone || 'Asia/Kolkata';
  if (!isValidTimezone(tz)) {
    throw new Error(`Invalid timezone: ${tz}`);
  }

  const startUtc = schedule.start_at_utc ? DateTime.fromISO(schedule.start_at_utc, { zone: 'utc' }) : null;
  const endUtc = schedule.end_at_utc ? DateTime.fromISO(schedule.end_at_utc, { zone: 'utc' }) : null;

  // Effective lower bound is the maximum of fromDt and startUtc
  const effectiveFrom = startUtc && startUtc > fromDt ? startUtc : fromDt;

  if (schedule.schedule_type === 'one_time') {
    if (!schedule.scheduled_at_utc) return null;
    const targetDt = DateTime.fromISO(schedule.scheduled_at_utc, { zone: 'utc' });
    if (targetDt > effectiveFrom) {
      if (endUtc && targetDt > endUtc) return null;
      return targetDt.toISO();
    }
    return null; // Already past
  }

  // Parse recurrence config
  let config = {};
  if (typeof schedule.recurrence_config === 'string') {
    try {
      config = JSON.parse(schedule.recurrence_config || '{}');
    } catch {
      config = {};
    }
  } else if (schedule.recurrence_config) {
    config = schedule.recurrence_config;
  }

  const timeStr = config.time || '09:00';
  const [hour, minute] = timeStr.split(':').map(Number);

  // Convert effectiveFrom to schedule's local timezone
  const localNow = effectiveFrom.setZone(tz);

  if (schedule.schedule_type === 'every_10_minutes') {
    if (startUtc && startUtc > fromDt) {
      if (endUtc && startUtc > endUtc) return null;
      return startUtc.toISO();
    }
    const currentMinute = localNow.minute;
    const nextMinuteMark = Math.floor(currentMinute / 10) * 10 + 10;
    let candidate = localNow.set({ minute: 0, second: 0, millisecond: 0 }).plus({ minutes: nextMinuteMark });
    if (candidate <= localNow) {
      candidate = candidate.plus({ minutes: 10 });
    }
    const candidateUtc = candidate.toUTC();
    if (endUtc && candidateUtc > endUtc) return null;
    return candidateUtc.toISO();
  }

  if (schedule.schedule_type === 'interval') {
    let intervalHours = 0;
    let intervalMinutes = 0;
    let intervalSeconds = 0;

    if (config.intervalHours !== undefined || config.intervalMinutes !== undefined || config.intervalSeconds !== undefined) {
      intervalHours = parseInt(config.intervalHours || '0', 10);
      intervalMinutes = parseInt(config.intervalMinutes || '0', 10);
      intervalSeconds = parseInt(config.intervalSeconds || '0', 10);
    }

    let totalSeconds = (intervalHours * 3600) + (intervalMinutes * 60) + intervalSeconds;
    if (totalSeconds <= 0) {
      if (config.totalMinutes) totalSeconds = config.totalMinutes * 60;
      else totalSeconds = 600;
    }

    // If start_at_utc is specified and is in the future, the first run is exactly start_at_utc!
    if (startUtc && startUtc > fromDt) {
      if (endUtc && startUtc > endUtc) return null;
      return startUtc.toISO();
    }

    let candidate;
    if (intervalSeconds > 0 || (intervalHours === 0 && intervalMinutes === 0)) {
      candidate = localNow.plus({ seconds: totalSeconds }).set({ millisecond: 0 });
    } else {
      candidate = localNow.plus({ seconds: totalSeconds }).set({ second: 0, millisecond: 0 });
    }

    if (candidate <= localNow) {
      candidate = candidate.plus({ seconds: totalSeconds });
    }

    const candidateUtc = candidate.toUTC();
    if (endUtc && candidateUtc > endUtc) return null;
    return candidateUtc.toISO();
  }

  if (schedule.schedule_type === 'daily') {
    // Check today at target time
    let candidate = localNow.set({ hour, minute, second: 0, millisecond: 0 });
    if (candidate <= localNow) {
      candidate = candidate.plus({ days: 1 });
    }

    const candidateUtc = candidate.toUTC();
    if (endUtc && candidateUtc > endUtc) return null;
    return candidateUtc.toISO();
  }

  if (schedule.schedule_type === 'weekly') {
    // weekdays: array of numbers 1 (Monday) to 7 (Sunday)
    const weekdays = Array.isArray(config.weekdays) && config.weekdays.length > 0
      ? config.weekdays.map(Number).sort((a, b) => a - b)
      : [1]; // default Monday

    // Search up to 14 days ahead for the next matching weekday
    for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
      const dayCandidate = localNow.plus({ days: dayOffset }).set({ hour, minute, second: 0, millisecond: 0 });
      if (weekdays.includes(dayCandidate.weekday) && dayCandidate > localNow) {
        const candidateUtc = dayCandidate.toUTC();
        if (endUtc && candidateUtc > endUtc) return null;
        return candidateUtc.toISO();
      }
    }
    return null;
  }

  if (schedule.schedule_type === 'monthly') {
    // dayOfMonth: 1 - 31
    const dayOfMonth = parseInt(config.dayOfMonth || '1', 10);

    // Search up to 12 months ahead
    for (let monthOffset = 0; monthOffset <= 12; monthOffset++) {
      const targetMonthDt = localNow.plus({ months: monthOffset });
      const daysInMonth = targetMonthDt.daysInMonth;
      // Clamp day to max days in this particular month (e.g. 28/29 for Feb, 30 for Apr)
      const targetDay = Math.min(dayOfMonth, daysInMonth);

      const candidate = targetMonthDt.set({
        day: targetDay,
        hour,
        minute,
        second: 0,
        millisecond: 0
      });

      if (candidate > localNow) {
        const candidateUtc = candidate.toUTC();
        if (endUtc && candidateUtc > endUtc) return null;
        return candidateUtc.toISO();
      }
    }
    return null;
  }

  return null;
}

/**
 * Generates a human-friendly description of the schedule.
 * @param {Object} schedule
 * @returns {string}
 */
export function getHumanSummary(schedule) {
  const tz = schedule.timezone || 'Asia/Kolkata';
  const tzAbbr = DateTime.now().setZone(tz).toFormat('ZZZZ');
  let config = {};
  if (typeof schedule.recurrence_config === 'string') {
    try { config = JSON.parse(schedule.recurrence_config || '{}'); } catch {}
  } else if (schedule.recurrence_config) {
    config = schedule.recurrence_config;
  }

  const recipient = schedule.recipient_name
    ? `${schedule.recipient_name} (${schedule.phone_number})`
    : schedule.phone_number;

  const msgSnippet = schedule.message.length > 30
    ? `"${schedule.message.substring(0, 30)}..."`
    : `"${schedule.message}"`;

  let summary = '';
  if (schedule.schedule_type === 'one_time') {
    const formattedDate = schedule.scheduled_at_utc
      ? formatInTimezone(schedule.scheduled_at_utc, tz, 'dd LLL yyyy, hh:mm a')
      : 'the configured time';
    summary = `Send ${msgSnippet} to ${recipient} once on ${formattedDate} (${tzAbbr}).`;
  } else {
    const time = config.time || '09:00';
    const [h, m] = time.split(':').map(Number);
    const timeFormatted = DateTime.fromObject({ hour: h, minute: m }).toFormat('hh:mm a');

    if (schedule.schedule_type === 'interval' || schedule.schedule_type === 'every_10_minutes') {
      const hours = parseInt(config.intervalHours || '0', 10);
      const mins = parseInt(config.intervalMinutes !== undefined ? config.intervalMinutes : (schedule.schedule_type === 'every_10_minutes' ? '10' : '0'), 10);
      const secs = parseInt(config.intervalSeconds || '0', 10);
      const dur = parseFloat(config.durationHours);
      
      let parts = [];
      if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
      if (mins > 0) parts.push(`${mins} min${mins > 1 ? 's' : ''}`);
      if (secs > 0) parts.push(`${secs} sec${secs > 1 ? 's' : ''}`);
      const intervalDesc = parts.length > 0 ? parts.join(' ') : '10 minutes';
      summary = `Send ${msgSnippet} to ${recipient} every ${intervalDesc} (${tzAbbr}).`;
      if (!isNaN(dur) && dur > 0) {
        summary += ` Active for ${dur} hour${dur === 1 ? '' : 's'}.`;
      }
    } else if (schedule.schedule_type === 'daily') {
      summary = `Send ${msgSnippet} to ${recipient} every day at ${timeFormatted} (${tzAbbr}).`;
    } else if (schedule.schedule_type === 'weekly') {
      const dayNames = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
      const days = (config.weekdays || [1]).map(d => dayNames[d] || d).join(', ');
      summary = `Send ${msgSnippet} to ${recipient} every week on ${days} at ${timeFormatted} (${tzAbbr}).`;
    } else if (schedule.schedule_type === 'monthly') {
      const day = config.dayOfMonth || 1;
      const suffix = ['th', 'st', 'nd', 'rd'][(day % 10 > 3 || Math.floor((day % 100) / 10) === 1) ? 0 : day % 10];
      summary = `Send ${msgSnippet} to ${recipient} every month on the ${day}${suffix} at ${timeFormatted} (${tzAbbr}).`;
    } else {
      summary = `Send ${msgSnippet} to ${recipient} as scheduled.`;
    }
  }

  if (config.autoIncrement) {
    const countVal = config.currentCount !== undefined ? config.currentCount : (config.startCount ?? 1);
    summary += ` (Auto-incrementing from #${countVal})`;
  }

  return summary;
}

export default {
  isValidTimezone,
  toUtcIso,
  formatInTimezone,
  calculateNextRun,
  getHumanSummary
};
