import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Globe, User, Phone, MessageSquare, AlertCircle, Sparkles, CheckCircle2, Hash } from 'lucide-react';
import ScheduleSummaryModal from './ScheduleSummaryModal.jsx';

const POPULAR_TIMEZONES = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC'
];

export function ScheduleForm({ initialData = null, onSubmit, isSubmitting = false }) {
  const isEdit = Boolean(initialData?.id);

  // Form states
  const [name, setName] = useState(initialData?.name || '');
  const [recipientName, setRecipientName] = useState(initialData?.recipient_name || '');
  const [phoneNumber, setPhoneNumber] = useState(initialData?.phone_number || '+91');
  const [message, setMessage] = useState(initialData?.message || '');
  const [scheduleType, setScheduleType] = useState(() => {
    if (initialData?.schedule_type === 'every_10_minutes') return 'interval';
    return initialData?.schedule_type || 'one_time';
  });
  const [timezone, setTimezone] = useState(initialData?.timezone || 'Asia/Kolkata');

  // Date & Time states
  const [oneTimeDate, setOneTimeDate] = useState(() => {
    if (initialData?.scheduled_at_utc) {
      return initialData.scheduled_at_utc.split('T')[0];
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [time, setTime] = useState(() => {
    if (initialData?.recurrence_config?.time) return initialData.recurrence_config.time;
    if (initialData?.scheduled_at_utc) {
      const parts = initialData.scheduled_at_utc.split('T')[1]?.split(':');
      if (parts && parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    }
    return '09:00';
  });

  const [intervalHours, setIntervalHours] = useState(() => {
    return initialData?.recurrence_config?.intervalHours !== undefined
      ? initialData.recurrence_config.intervalHours
      : 0;
  });
  const [intervalMinutes, setIntervalMinutes] = useState(() => {
    if (initialData?.recurrence_config?.intervalMinutes !== undefined) {
      return initialData.recurrence_config.intervalMinutes;
    }
    return 10;
  });
  const [intervalSeconds, setIntervalSeconds] = useState(() => {
    return initialData?.recurrence_config?.intervalSeconds !== undefined
      ? initialData.recurrence_config.intervalSeconds
      : 0;
  });
  const [durationHours, setDurationHours] = useState(() => {
    if (initialData?.recurrence_config?.durationHours !== undefined && initialData?.recurrence_config?.durationHours !== null) {
      return initialData.recurrence_config.durationHours;
    }
    return '';
  });

  // Auto-Increment states
  const [autoIncrement, setAutoIncrement] = useState(() => {
    return initialData?.recurrence_config?.autoIncrement !== undefined
      ? Boolean(initialData.recurrence_config.autoIncrement)
      : false;
  });
  const [startCount, setStartCount] = useState(() => {
    return initialData?.recurrence_config?.startCount !== undefined
      ? initialData.recurrence_config.startCount
      : 1;
  });
  const [currentCount, setCurrentCount] = useState(() => {
    return initialData?.recurrence_config?.currentCount !== undefined
      ? initialData.recurrence_config.currentCount
      : (initialData?.recurrence_config?.startCount !== undefined ? initialData.recurrence_config.startCount : 1);
  });

  // Recurrence states
  const [weekdays, setWeekdays] = useState(() => {
    return initialData?.recurrence_config?.weekdays || [1]; // 1 = Monday
  });
  const [dayOfMonth, setDayOfMonth] = useState(() => {
    return initialData?.recurrence_config?.dayOfMonth || 1;
  });
  const [startDate, setStartDate] = useState(() => {
    return initialData?.start_at_utc ? initialData.start_at_utc.split('T')[0] : '';
  });
  const [endDate, setEndDate] = useState(() => {
    return initialData?.end_at_utc ? initialData.end_at_utc.split('T')[0] : '';
  });
  const [enabled, setEnabled] = useState(initialData ? Boolean(initialData.enabled) : true);

  // UI / Confirmation states
  const [errors, setErrors] = useState([]);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryPreview, setSummaryPreview] = useState('');

  // Update dynamic summary preview
  useEffect(() => {
    const recipient = recipientName ? `${recipientName} (${phoneNumber})` : phoneNumber || 'recipient';
    const msgSnippet = message.length > 25 ? `"${message.substring(0, 25)}..."` : `"${message || '...'}"`;

    let summary = '';
    if (scheduleType === 'one_time') {
      summary = `Send ${msgSnippet} to ${recipient} once on ${oneTimeDate || 'selected date'} at ${time || '09:00'} (${timezone}).`;
    } else if (scheduleType === 'interval' || scheduleType === 'every_10_minutes') {
      const parts = [];
      if (intervalHours > 0) parts.push(`${intervalHours} hr${intervalHours > 1 ? 's' : ''}`);
      if (intervalMinutes > 0) parts.push(`${intervalMinutes} min${intervalMinutes > 1 ? 's' : ''}`);
      if (intervalSeconds > 0) parts.push(`${intervalSeconds} sec${intervalSeconds > 1 ? 's' : ''}`);
      const desc = parts.length > 0 ? parts.join(' ') : '10 seconds';
      summary = `Send ${msgSnippet} to ${recipient} every ${desc} (${timezone}).`;
      const dur = parseFloat(durationHours);
      if (!isNaN(dur) && dur > 0) {
        summary += ` Active for ${dur} hour${dur === 1 ? '' : 's'}.`;
      }
    } else if (scheduleType === 'daily') {
      summary = `Send ${msgSnippet} to ${recipient} every day at ${time || '09:00'} (${timezone}).`;
    } else if (scheduleType === 'weekly') {
      const dayNames = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
      const daysStr = weekdays.map(d => dayNames[d] || d).join(', ') || 'selected days';
      summary = `Send ${msgSnippet} to ${recipient} every week on ${daysStr} at ${time || '09:00'} (${timezone}).`;
    } else if (scheduleType === 'monthly') {
      const day = dayOfMonth || 1;
      const suffix = ['th', 'st', 'nd', 'rd'][(day % 10 > 3 || Math.floor((day % 100) / 10) === 1) ? 0 : day % 10];
      summary = `Send ${msgSnippet} to ${recipient} every month on the ${day}${suffix} at ${time || '09:00'} (${timezone}).`;
    }

    if (scheduleType !== 'interval' && scheduleType !== 'every_10_minutes' && (startDate || endDate)) {
      summary += ` Effective ${startDate ? `from ${startDate}` : ''} ${endDate ? `until ${endDate}` : ''}.`;
    }

    if (autoIncrement) {
      const num = currentCount || startCount || 1;
      summary += ` Auto-incrementing from #${num}.`;
    }

    setSummaryPreview(summary);
  }, [name, recipientName, phoneNumber, message, scheduleType, timezone, oneTimeDate, time, weekdays, dayOfMonth, startDate, endDate, intervalHours, intervalMinutes, intervalSeconds, durationHours, autoIncrement, startCount, currentCount]);

  const toggleWeekday = (dayNum) => {
    if (weekdays.includes(dayNum)) {
      if (weekdays.length > 1) {
        setWeekdays(weekdays.filter(d => d !== dayNum));
      }
    } else {
      setWeekdays([...weekdays, dayNum].sort((a, b) => a - b));
    }
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    const errs = [];

    if (!phoneNumber || !phoneNumber.trim()) {
      errs.push('WhatsApp phone number is required.');
    } else if (!phoneNumber.startsWith('+') || phoneNumber.replace(/\D/g, '').length < 8) {
      errs.push('Phone number must start with + and include country code (e.g. +919876543210).');
    }

    if (!message || !message.trim()) {
      errs.push('Message text is required.');
    }

    if (scheduleType === 'one_time') {
      if (!oneTimeDate) {
        errs.push('Scheduled date is required for one-time messages.');
      }
    }

    if (scheduleType === 'interval') {
      const totalSecs = (intervalHours * 3600) + (intervalMinutes * 60) + intervalSeconds;
      if (totalSecs < 1) {
        errs.push('Interval must be at least 1 second. Please specify hours, minutes, and/or seconds.');
      }
      if (durationHours !== '' && (isNaN(parseFloat(durationHours)) || parseFloat(durationHours) <= 0)) {
        errs.push('Duration in hours must be a positive number (or leave empty for unlimited).');
      }
    }

    if (scheduleType === 'weekly' && weekdays.length === 0) {
      errs.push('Please select at least one weekday.');
    }

    if (errs.length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setErrors([]);
    setIsSummaryModalOpen(true);
  };

  const handleConfirmedSave = async () => {
    // Construct payload
    let scheduledAtUtc = null;
    let recurrenceConfig = null;
    let calculatedStartAtUtc = null;
    let calculatedEndAtUtc = null;

    const parsedStartCount = parseInt(startCount || '1', 10);
    const parsedCurrentCount = parseInt(currentCount || startCount || '1', 10);

    if (scheduleType === 'one_time') {
      // Build ISO string in selected timezone
      scheduledAtUtc = new Date(`${oneTimeDate}T${time}:00`).toISOString();
      if (autoIncrement) {
        recurrenceConfig = {
          autoIncrement: true,
          startCount: isNaN(parsedStartCount) ? 1 : parsedStartCount,
          currentCount: isNaN(parsedCurrentCount) ? 1 : parsedCurrentCount
        };
      }
    } else if (scheduleType === 'interval' || scheduleType === 'every_10_minutes') {
      const h = parseInt(intervalHours || '0', 10);
      const m = parseInt(intervalMinutes !== undefined ? intervalMinutes : '10', 10);
      const s = parseInt(intervalSeconds || '0', 10);
      const dur = durationHours !== '' && !isNaN(parseFloat(durationHours)) && parseFloat(durationHours) > 0 ? parseFloat(durationHours) : null;
      recurrenceConfig = {
        intervalHours: h,
        intervalMinutes: m,
        intervalSeconds: s,
        durationHours: dur,
        totalSeconds: (h * 3600) + (m * 60) + s,
        autoIncrement: Boolean(autoIncrement),
        startCount: isNaN(parsedStartCount) ? 1 : parsedStartCount,
        currentCount: isNaN(parsedCurrentCount) ? 1 : parsedCurrentCount
      };
      calculatedStartAtUtc = null;
      if (dur) {
        calculatedEndAtUtc = new Date(Date.now() + (dur * 3600 * 1000)).toISOString();
      }
    } else {
      recurrenceConfig = {
        time,
        weekdays: scheduleType === 'weekly' ? weekdays : undefined,
        dayOfMonth: scheduleType === 'monthly' ? parseInt(dayOfMonth, 10) : undefined,
        autoIncrement: Boolean(autoIncrement),
        startCount: isNaN(parsedStartCount) ? 1 : parsedStartCount,
        currentCount: isNaN(parsedCurrentCount) ? 1 : parsedCurrentCount
      };
      calculatedStartAtUtc = startDate ? `${startDate}T00:00:00.000Z` : null;
      calculatedEndAtUtc = endDate ? `${endDate}T23:59:59.999Z` : null;
    }

    const payload = {
      name: name.trim() || null,
      recipient_name: recipientName.trim() || null,
      phone_number: phoneNumber.trim(),
      message: message.trim(),
      schedule_type: scheduleType,
      timezone,
      recurrence_config: recurrenceConfig,
      start_at_utc: calculatedStartAtUtc,
      end_at_utc: calculatedEndAtUtc,
      enabled: enabled ? 1 : 0,
      status: enabled ? 'active' : 'paused'
    };

    if (scheduleType === 'one_time') {
      payload.scheduled_at_utc = scheduledAtUtc;
    }

    try {
      await onSubmit(payload);
      setIsSummaryModalOpen(false);
    } catch (err) {
      setIsSummaryModalOpen(false);
      if (err.details && Array.isArray(err.details) && err.details.length > 0) {
        setErrors(err.details);
      } else {
        setErrors([err.message || 'Failed to save schedule']);
      }
    }
  };

  const dayLabels = [
    { num: 1, label: 'Mon' },
    { num: 2, label: 'Tue' },
    { num: 3, label: 'Wed' },
    { num: 4, label: 'Thu' },
    { num: 5, label: 'Fri' },
    { num: 6, label: 'Sat' },
    { num: 7, label: 'Sun' }
  ];

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            Please review the following issues:
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-rose-700">
            {errors.map((e, idx) => (
              <li key={idx}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handlePreSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Inputs (2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Basic & Recipient Info */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" />
                Recipient & Overview
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Schedule Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Daily Standup Reminder"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Recipient Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Sandip Ganava"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  WhatsApp Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+919876543210"
                    required
                    className="w-full pl-10 pr-3.5 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Must include leading <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">+</code> and international dial code (e.g. +91 for India, +1 for US/Canada).
                </p>
              </div>
            </div>

            {/* Section 2: Message Content */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Message Content
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {message.length} / 4096 characters
                </span>
              </div>

              <div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here... e.g. I love you"
                  rows={4}
                  required
                  maxLength={4096}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors resize-y leading-relaxed font-sans"
                />
              </div>

              {/* Auto-Increment Option Card */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-slate-200/90 rounded-xl p-4 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg transition-colors ${autoIncrement ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'}`}>
                      <Hash className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Auto-Increment Message Number</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                          Feature
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Automatically increases a counter on every send (e.g. "I love you 1", "I love you 2", ...)
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                    <input
                      type="checkbox"
                      checked={autoIncrement}
                      onChange={(e) => setAutoIncrement(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {autoIncrement && (
                  <div className="mt-4 pt-3.5 border-t border-slate-200/80 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Starting Number
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={startCount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStartCount(val);
                            if (!isEdit) setCurrentCount(val);
                          }}
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          First message will start at #{startCount || 1}
                        </span>
                      </div>

                      {isEdit && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Current Next Number
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={currentCount}
                            onChange={(e) => setCurrentCount(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            The very next scheduled dispatch will send #{currentCount || 1}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white/80 border border-indigo-100 rounded-lg text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>
                          Custom placement: Use <code className="bg-indigo-50 text-indigo-700 font-mono px-1 py-0.5 rounded font-bold">{'{count}'}</code> anywhere in your message. If omitted, the number is added at the end.
                        </span>
                      </div>
                      {!message.includes('{count}') && (
                        <button
                          type="button"
                          onClick={() => setMessage(prev => prev ? `${prev} {count}` : '{count}')}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors shrink-0"
                        >
                          + Insert {'{count}'} tag
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Schedule Timing & Recurrence */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Schedule & Frequency
              </h3>

              {/* Schedule Type Tabs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Schedule Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'one_time', label: 'One-Time' },
                    { id: 'interval', label: 'Interval (Hrs, Mins & Secs)' },
                    { id: 'daily', label: 'Daily' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'monthly', label: 'Monthly' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setScheduleType(type.id)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${scheduleType === type.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic timing inputs based on type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {scheduleType === 'interval' || scheduleType === 'every_10_minutes' ? (
                  <div className="md:col-span-2 space-y-3 bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-600" />
                        Specify Interval (Hours, Minutes & Seconds)
                      </label>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                        Every {(() => {
                          const parts = [];
                          if (intervalHours > 0) parts.push(`${intervalHours} hr`);
                          if (intervalMinutes > 0) parts.push(`${intervalMinutes} min`);
                          if (intervalSeconds > 0) parts.push(`${intervalSeconds} sec`);
                          return parts.length > 0 ? parts.join(' ') : '0s';
                        })()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Hours (0 - 72)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="72"
                          value={intervalHours}
                          onChange={(e) => setIntervalHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Minutes (0 - 59)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={intervalMinutes}
                          onChange={(e) => setIntervalMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Seconds (0 - 59)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={intervalSeconds}
                          onChange={(e) => setIntervalSeconds(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Quick Select Presets:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '10 Secs', h: 0, m: 0, s: 10 },
                          { label: '30 Secs', h: 0, m: 0, s: 30 },
                          { label: '1 Min', h: 0, m: 1, s: 0 },
                          { label: '5 Mins', h: 0, m: 5, s: 0 },
                          { label: '10 Mins', h: 0, m: 10, s: 0 },
                          { label: '30 Mins', h: 0, m: 30, s: 0 },
                          { label: '1 Hour', h: 1, m: 0, s: 0 },
                          { label: '2 Hours', h: 2, m: 0, s: 0 }
                        ].map((preset) => {
                          const isSelected = intervalHours === preset.h && intervalMinutes === preset.m && intervalSeconds === preset.s;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                setIntervalHours(preset.h);
                                setIntervalMinutes(preset.m);
                                setIntervalSeconds(preset.s);
                              }}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {intervalHours === 0 && intervalMinutes === 0 && intervalSeconds > 0 && intervalSeconds < 15 && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Caution: Sending intervals faster than 15s may trigger WhatsApp automated anti-spam restrictions.</span>
                      </div>
                    )}
                  </div>
                ) : scheduleType === 'one_time' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Scheduled Date</label>
                    <input
                      type="date"
                      value={oneTimeDate}
                      onChange={(e) => setOneTimeDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                    />
                  </div>
                ) : scheduleType === 'monthly' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Day of Month (1 - 31)</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                      required
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                    />
                  </div>
                ) : null}

                {scheduleType !== 'every_10_minutes' && scheduleType !== 'interval' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Execution Time (24h)</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Weekly Day Checkboxes */}
              {scheduleType === 'weekly' && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Select Days of Week</label>
                  <div className="flex flex-wrap gap-2">
                    {dayLabels.map((d) => {
                      const isSelected = weekdays.includes(d.num);
                      return (
                        <button
                          key={d.num}
                          type="button"
                          onClick={() => toggleWeekday(d.num)}
                          className={`w-11 h-10 rounded-lg text-xs font-bold transition-all border ${isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timezone & Boundaries */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Time Zone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white transition-colors"
                  >
                    {POPULAR_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>

                {scheduleType === 'interval' || scheduleType === 'every_10_minutes' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">Duration in Hours</label>
                      {durationHours !== '' && parseFloat(durationHours) > 0 && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Runs for {durationHours} hr{parseFloat(durationHours) === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value)}
                      placeholder="e.g. 2 (leave blank for unlimited)"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white transition-colors"
                    />
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] font-medium text-slate-400">Quick:</span>
                      {[
                        { label: '1h', val: 1 },
                        { label: '2h', val: 2 },
                        { label: '4h', val: 4 },
                        { label: '8h', val: 8 },
                        { label: '24h', val: 24 },
                        { label: 'Unlimited', val: '' }
                      ].map((preset) => {
                        const isSelected =
                          (preset.val === '' && (durationHours === '' || durationHours === '0')) ||
                          (preset.val !== '' && parseFloat(durationHours) === preset.val);
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setDurationHours(preset.val === '' ? '' : String(preset.val))}
                            className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-all ${isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : scheduleType !== 'one_time' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">Initial Status</span>
                  <span className="text-xs text-slate-400">Enable immediately or save as paused</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-3 text-xs font-semibold text-slate-700">
                    {enabled ? 'Active' : 'Paused'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Live Summary & WhatsApp Message Preview */}
          <div className="space-y-6">
            {/* Live Human-readable Summary Card */}
            <div className="bg-emerald-900 text-emerald-50 p-6 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Schedule Summary
              </div>
              <p className="text-sm font-medium leading-relaxed">
                {summaryPreview || 'Fill out the form to preview the schedule summary.'}
              </p>
            </div>

            {/* Simulated WhatsApp Chat Balloon */}
            <div className="bg-[#ECE5DD] p-5 rounded-2xl border border-slate-300 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  WhatsApp Preview
                </span>
                {autoIncrement && (
                  <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                    Auto-increment: #{currentCount || startCount || 1}
                  </span>
                )}
              </div>
              <div className="bg-white rounded-lg p-3 shadow-xs max-w-[90%] ml-auto rounded-tr-none border border-emerald-100">
                <p className="text-xs text-slate-900 whitespace-pre-wrap break-words leading-relaxed font-sans">
                  {(() => {
                    if (!message) {
                      return <span className="text-slate-400 italic">Message preview will appear here...</span>;
                    }
                    if (!autoIncrement) return message;
                    const countVal = currentCount || startCount || 1;
                    const countRegex = /\{count\}|\{n\}|\{\{count\}\}|\{\{n\}\}/gi;
                    if (countRegex.test(message)) {
                      return message.replace(countRegex, String(countVal));
                    }
                    return `${message.trimEnd()} ${countVal}`;
                  })()}
                </p>
                <div className="text-[10px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1 font-mono">
                  <span>{time || '09:00'}</span>
                  <CheckCircle2 className="w-3 h-3 text-slate-400" />
                </div>
              </div>
              {autoIncrement && (
                <p className="text-[10px] text-slate-500 text-right mt-1.5 italic">
                  Next sends will automatically become #{Number(currentCount || startCount || 1) + 1}, #{Number(currentCount || startCount || 1) + 2}, etc.
                </p>
              )}
            </div>

            {/* Submit Action */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-emerald-200 transition-colors flex items-center justify-center gap-2"
              >
                <span>{isEdit ? 'Review & Update Schedule' : 'Review & Enable Schedule'}</span>
              </button>
              <p className="text-[11px] text-slate-400 text-center leading-normal">
                You will review a confirmation summary before the schedule is registered.
              </p>
            </div>
          </div>
        </div>
      </form>

      {/* Confirmation Modal */}
      <ScheduleSummaryModal
        isOpen={isSummaryModalOpen}
        summaryText={summaryPreview}
        onConfirm={handleConfirmedSave}
        onCancel={() => setIsSummaryModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

export default ScheduleForm;
