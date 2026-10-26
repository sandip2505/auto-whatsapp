import React from 'react';
import { X, Calendar, Clock, Globe, User, Phone, MessageSquare, CheckCircle, AlertTriangle } from 'lucide-react';
import StatusBadge from '../Common/StatusBadge.jsx';

export function ScheduleDetailsModal({ schedule, isOpen, onClose }) {
  if (!isOpen || !schedule) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-slate-900">{schedule.name || 'Untitled Schedule'}</h3>
              <StatusBadge status={schedule.status} />
            </div>
            <p className="text-xs text-slate-500">Schedule ID: #{schedule.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Human summary banner */}
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-emerald-950 text-sm font-medium mb-6">
          {schedule.human_summary}
        </div>

        {/* Meta Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Recipient</span>
            <div className="flex items-center gap-2 text-sm text-slate-800">
              <User className="w-4 h-4 text-slate-400" />
              <span>{schedule.recipient_name || 'No name specified'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-800 font-mono">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>{schedule.phone_number}</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Timing</span>
            <div className="flex items-center gap-2 text-sm text-slate-800">
              <Globe className="w-4 h-4 text-slate-400" />
              <span>Timezone: {schedule.timezone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-800">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Next Execution: {schedule.next_run_formatted || 'None (Completed/Paused)'}</span>
            </div>
          </div>
        </div>

        {/* Message Content */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Message Body</span>
            {schedule.recurrence_config?.autoIncrement && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Auto-increment Next: #{schedule.recurrence_config.currentCount ?? schedule.recurrence_config.startCount ?? 1}
              </span>
            )}
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {schedule.message}
          </div>
        </div>

        {/* Recent Executions for this Schedule */}
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Recent Execution History</span>
          {schedule.recent_executions && schedule.recent_executions.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Attempted At</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Message ID</th>
                    <th className="py-2.5 px-3">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedule.recent_executions.map((exec) => (
                    <tr key={exec.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {new Date(exec.attempted_at_utc).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={exec.status} />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 truncate max-w-[140px]">
                        {exec.whatsapp_message_id || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-rose-600 truncate max-w-[140px]">
                        {exec.error_message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
              No executions have run for this schedule yet.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScheduleDetailsModal;
