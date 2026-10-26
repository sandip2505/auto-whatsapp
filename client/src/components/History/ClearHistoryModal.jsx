import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, CheckSquare, Square } from 'lucide-react';

export function ClearHistoryModal({ isOpen, totalLogs, onConfirm, onCancel, isClearing }) {
  const [scope, setScope] = useState('all'); // 'all' | 'older_than' | 'failed_only'
  const [days, setDays] = useState('30');
  const [clearSystemLogs, setClearSystemLogs] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      scope,
      days: scope === 'older_than' ? parseInt(days, 10) : undefined,
      clearSystemLogs
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Clear Execution History</h3>
              <p className="text-xs text-slate-500">Permanently delete execution & audit logs</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isClearing}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select What to Clear
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/70 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="clearScope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">All execution records</div>
                  <div className="text-slate-400">Permanently delete all {totalLogs} execution attempt entries</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/70 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="clearScope"
                  value="failed_only"
                  checked={scope === 'failed_only'}
                  onChange={() => setScope('failed_only')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">Only failed & skipped attempts</div>
                  <div className="text-slate-400">Preserve successful deliveries, delete errors & timeouts</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/70 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="clearScope"
                  value="older_than"
                  checked={scope === 'older_than'}
                  onChange={() => setScope('older_than')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs flex-1">
                  <div className="font-semibold text-slate-800 mb-1">Records older than</div>
                  <select
                    value={days}
                    onChange={(e) => {
                      setDays(e.target.value);
                      setScope('older_than');
                    }}
                    disabled={scope !== 'older_than'}
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-50"
                  >
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                  </select>
                </div>
              </label>
            </div>
          </div>

          {/* System Audit Logs option */}
          <div className="pt-1">
            <label
              onClick={() => setClearSystemLogs(!clearSystemLogs)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none"
            >
              <div className="text-emerald-600">
                {clearSystemLogs ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
              </div>
              <span>Also clear internal system audit logs</span>
            </label>
            <p className="text-[11px] text-slate-400 pl-6 mt-0.5">
              Purges system debugging events and connection logs from SQLite.
            </p>
          </div>

          {/* Warning notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              This action cannot be undone. Scheduled recurring occurrences will continue to run normally, but past attempt history will be wiped.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isClearing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isClearing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isClearing ? 'Clearing...' : 'Clear Selected Logs'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClearHistoryModal;
