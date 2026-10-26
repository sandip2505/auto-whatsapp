import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  ArrowRight,
  ShieldAlert,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Send
} from 'lucide-react';
import api from '../services/api.js';
import StatusBadge from '../components/Common/StatusBadge.jsx';

export function DashboardPage({ setCurrentTab, onSelectScheduleForEdit }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.getDashboardStats({ timezone: userTz });
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-emerald-600" />
        <span className="text-sm font-medium">Loading dashboard overview...</span>
      </div>
    );
  }

  const counts = stats?.counts || { total: 0, active: 0, paused: 0, successful: 0, failed: 0, todaySent: 0, todayFailed: 0, todayTotal: 0 };
  const whatsapp = stats?.whatsapp || { status: 'disconnected' };
  const nextSchedule = stats?.nextSchedule;
  const recentExecutions = stats?.recentExecutions || [];

  return (
    <div className="space-y-8">
      {/* WhatsApp Connection Alert / Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${
            whatsapp.status === 'ready'
              ? 'bg-emerald-100 text-emerald-700'
              : whatsapp.status === 'auth_required'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-slate-900 text-sm">WhatsApp Connection Status</h3>
              <StatusBadge status={whatsapp.status} type="whatsapp" />
              {whatsapp.isMock && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  TEST / MOCK MODE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {whatsapp.status === 'ready'
                ? `Connected as ${whatsapp.authenticatedUser?.pushname || 'WhatsApp User'} (${whatsapp.authenticatedUser?.phone || 'Linked'})`
                : whatsapp.status === 'auth_required'
                ? 'Your WhatsApp account needs to be paired using WhatsApp Linked Devices.'
                : 'WhatsApp client is currently disconnected.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {whatsapp.status !== 'ready' ? (
            <button
              onClick={() => setCurrentTab('whatsapp')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-200 transition-colors"
            >
              Scan QR & Connect
            </button>
          ) : (
            <button
              onClick={() => setCurrentTab('whatsapp')}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              Session Details
            </button>
          )}
          <button
            onClick={loadDashboard}
            title="Refresh stats"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* 1. Total Schedules */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>TOTAL SCHEDULES</span>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{counts.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Configured in database</div>
        </div>

        {/* 2. Active Jobs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold mb-2">
            <span>ACTIVE JOBS</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{counts.active}</div>
          <div className="text-[11px] text-slate-400 mt-1">{counts.paused} paused schedules</div>
        </div>

        {/* 3. Sent Today (New Requested Feature!) */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-white via-white to-emerald-50/50 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <span>SENT TODAY</span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Today
              </span>
            </span>
            <Send className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{counts.todaySent || 0}</div>
          <div className="text-[11px] text-emerald-600/90 font-medium mt-1">
            {counts.todaySent === 1 ? '1 message sent today' : `${counts.todaySent || 0} messages sent today`}
          </div>
        </div>

        {/* 4. Total Successful Sends */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>TOTAL SENDS</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{counts.successful}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>All-time dispatched</span>
            {counts.todaySent > 0 && (
              <span className="text-emerald-600 font-semibold text-[10px]">+{counts.todaySent} today</span>
            )}
          </div>
        </div>

        {/* 5. Failures / Uncertain */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold mb-2">
            <span>FAILURES / UNCERTAIN</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {counts.failed + (counts.uncertain || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {counts.uncertain ? `${counts.uncertain} uncertain` : 'Requires attention'}
          </div>
        </div>
      </div>

      {/* Next Scheduled Message Card */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-4 h-4 text-emerald-400" />
              Next Scheduled Execution
            </div>
            {nextSchedule ? (
              <>
                <h4 className="text-lg font-bold text-white">
                  {nextSchedule.name || 'Untitled Schedule'} — to {nextSchedule.recipient_name || nextSchedule.phone_number}
                </h4>
                <p className="text-xs text-emerald-100/90 leading-relaxed max-w-2xl">
                  {nextSchedule.human_summary}
                </p>
                <div className="text-[11px] font-mono text-emerald-300 pt-1">
                  Scheduled for: <span className="underline font-semibold">{nextSchedule.next_run_formatted}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-emerald-100 font-medium py-2">
                No active schedules waiting in the queue.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('create')}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Schedule</span>
            </button>
            <button
              onClick={() => setCurrentTab('schedules')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Execution History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recent Send History</h3>
            <p className="text-xs text-slate-400">Latest message execution attempts and outcomes</p>
          </div>
          <button
            onClick={() => setCurrentTab('history')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            Full History <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentExecutions.length > 0 ? (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Message Snippet</th>
                  <th className="py-3 px-4">Attempted At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">WhatsApp ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentExecutions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {exec.schedule_name || 'Schedule'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {exec.recipient_phone_masked}
                    </td>
                    <td className="py-3 px-4 text-slate-700 truncate max-w-xs">
                      {exec.message_snippet}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {new Date(exec.attempted_at_utc).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={exec.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 truncate max-w-[120px]">
                      {exec.whatsapp_message_id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <CalendarClock className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No messages have been executed yet.</p>
            <p className="text-xs">Create a schedule to get started with automated messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
