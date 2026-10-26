import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Globe,
  Phone,
  Clock,
  Database,
  Terminal,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Layers
} from 'lucide-react';
import api from '../services/api.js';

const TIMEZONES = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC'
];

export function SettingsPage({ onSettingsUpdated }) {
  const [settings, setSettings] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'logs'
  const [feedback, setFeedback] = useState(null);

  // Form states
  const [defaultTimezone, setDefaultTimezone] = useState('Asia/Kolkata');
  const [defaultCountryCode, setDefaultCountryCode] = useState('+91');
  const [missedJobPolicy, setMissedJobPolicy] = useState('skip');
  const [maxRetryAttempts, setMaxRetryAttempts] = useState('3');
  const [retryDelayMs, setRetryDelayMs] = useState('60000');
  const [whatsappMock, setWhatsappMock] = useState('false');

  // Logs filters
  const [logLevel, setLogLevel] = useState('');
  const [logSource, setLogSource] = useState('');

  const loadSettingsAndLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      if (res.success) {
        setSettings(res.data.settings);
        setSystemInfo(res.data.systemInfo);

        setDefaultTimezone(res.data.settings.default_timezone || 'Asia/Kolkata');
        setDefaultCountryCode(res.data.settings.default_country_code || '+91');
        setMissedJobPolicy(res.data.settings.missed_job_policy || 'skip');
        setMaxRetryAttempts(res.data.settings.max_retry_attempts || '3');
        setRetryDelayMs(res.data.settings.retry_delay_ms || '60000');
        setWhatsappMock(res.data.settings.whatsapp_mock || 'false');
      }

      const logsRes = await api.getSystemLogs({ level: logLevel, source: logSource, limit: 50 });
      if (logsRes.success) {
        setLogs(logsRes.data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsAndLogs();
  }, [logLevel, logSource]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.updateSettings({
        default_timezone: defaultTimezone,
        default_country_code: defaultCountryCode,
        missed_job_policy: missedJobPolicy,
        max_retry_attempts: maxRetryAttempts,
        retry_delay_ms: retryDelayMs,
        whatsapp_mock: whatsappMock
      });

      if (res.success) {
        setFeedback({ type: 'success', message: 'Settings updated successfully.' });
        if (onSettingsUpdated) onSettingsUpdated(defaultTimezone);
        loadSettingsAndLogs();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearSystemLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all system audit logs? This action cannot be undone.')) {
      return;
    }
    setClearingLogs(true);
    setFeedback(null);
    try {
      const res = await api.clearSystemLogs();
      if (res.success) {
        setLogs([]);
        setFeedback({ type: 'success', message: res.message || 'System audit logs cleared successfully.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to clear system audit logs.' });
    } finally {
      setClearingLogs(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="py-20 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
        <span className="text-sm font-medium">Loading system preferences...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tab Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'config'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Application Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'logs'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Application System Logs</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {activeTab === 'config' ? (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Localization & Time */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600" />
              Localization & Regional Defaults
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Default Time Zone
                </label>
                <select
                  value={defaultTimezone}
                  onChange={(e) => setDefaultTimezone(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Default schedule calculation and local clock time zone (default: Asia/Kolkata).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Default Country Dialing Code
                </label>
                <input
                  type="text"
                  value={defaultCountryCode}
                  onChange={(e) => setDefaultCountryCode(e.target.value)}
                  placeholder="+91"
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Prefix suggested automatically when typing phone numbers (e.g. +91, +1, +44).
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Scheduler Policies & Retries */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Scheduler & Offline Missed-Job Policy
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Missed-Job Policy on App Restart
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    missedJobPolicy === 'skip'
                      ? 'border-emerald-600 bg-emerald-50/50'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}>
                    <input
                      type="radio"
                      name="missedJobPolicy"
                      value="skip"
                      checked={missedJobPolicy === 'skip'}
                      onChange={() => setMissedJobPolicy('skip')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Skip Missed Occurrences (Recommended)</span>
                      <span className="text-[11px] text-slate-500 leading-normal block mt-0.5">
                        If the computer or app was offline during a scheduled time, skip the missed run, log it as 'skipped', and advance to the next future occurrence.
                      </span>
                    </div>
                  </label>

                  <label className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    missedJobPolicy === 'manual_retry'
                      ? 'border-emerald-600 bg-emerald-50/50'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}>
                    <input
                      type="radio"
                      name="missedJobPolicy"
                      value="manual_retry"
                      checked={missedJobPolicy === 'manual_retry'}
                      onChange={() => setMissedJobPolicy('manual_retry')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Manual Retry Flag</span>
                      <span className="text-[11px] text-slate-500 leading-normal block mt-0.5">
                        Advance the schedule and flag overdue occurrences in the audit history so you can review and trigger a manual retry if desired.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Max Retry Attempts
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxRetryAttempts}
                    onChange={(e) => setMaxRetryAttempts(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    WhatsApp Mock / Testing Mode
                  </label>
                  <select
                    value={whatsappMock}
                    onChange={(e) => setWhatsappMock(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                  >
                    <option value="false">Disabled (Real WhatsApp Web Client)</option>
                    <option value="true">Enabled (Simulated WhatsApp Sending for Testing)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: System Environment Info */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Environment & Storage Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-sans block mb-1">SQLite Database Location</span>
                <span className="text-slate-800 break-all">{systemInfo?.databasePath || '—'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-sans block mb-1">Application Version</span>
                <span className="text-slate-800">v{systemInfo?.appVersion} (Node {systemInfo?.nodeVersion})</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-emerald-200 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* System Logs Viewer Tab */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700"
              >
                <option value="">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>

              <select
                value={logSource}
                onChange={(e) => setLogSource(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700"
              >
                <option value="">All Sources</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="scheduler">Scheduler</option>
                <option value="api">API</option>
                <option value="system">System</option>
              </select>
            </div>

            <button
              onClick={loadSettingsAndLogs}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleClearSystemLogs}
              disabled={clearingLogs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-colors disabled:opacity-50"
              title="Clear all system audit logs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>{clearingLogs ? 'Clearing...' : 'Clear Audit Logs'}</span>
            </button>
          </div>

          <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs max-h-[500px] overflow-y-auto space-y-1.5 shadow-inner">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div key={log.id} className="leading-relaxed hover:bg-slate-800/50 p-1 rounded">
                  <span className="text-slate-500">[{new Date(log.created_at).toLocaleTimeString()}]</span>{' '}
                  <span className={`font-bold ${
                    log.level === 'error'
                      ? 'text-rose-400'
                      : log.level === 'warn'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    [{log.level.toUpperCase()}]
                  </span>{' '}
                  <span className="text-blue-400">[{log.source}]</span>{' '}
                  <span className="text-slate-200">{log.message}</span>
                  {log.details && (
                    <div className="text-slate-400 text-[11px] pl-4">{log.details}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-500">No system logs found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
