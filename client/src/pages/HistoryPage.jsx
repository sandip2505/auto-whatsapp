import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Info
} from 'lucide-react';
import api from '../services/api.js';
import StatusBadge from '../components/Common/StatusBadge.jsx';
import ConfirmModal from '../components/Common/ConfirmModal.jsx';
import ClearHistoryModal from '../components/History/ClearHistoryModal.jsx';

export function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Retry modal & action states
  const [retryTarget, setRetryTarget] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFeedback, setRetryFeedback] = useState(null);

  // Clear history modal state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getHistory({
        status: statusFilter,
        search,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        page,
        limit: 20
      });
      if (res.success) {
        setHistory(res.data.history);
        setTotal(res.data.total);
      }
    } catch (err) {
      setError(err.message || 'Failed to load execution history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [statusFilter, search, startDate, endDate, page]);

  const handleExecuteRetry = async () => {
    if (!retryTarget) return;
    setIsRetrying(true);
    setRetryFeedback(null);
    try {
      const confirmUncertain = retryTarget.status === 'uncertain';
      const res = await api.retryHistory(retryTarget.id, confirmUncertain);
      if (res.success) {
        setRetryFeedback({ type: 'success', message: 'Manual retry submitted successfully.' });
        setRetryTarget(null);
        fetchHistory();
      }
    } catch (err) {
      setRetryFeedback({ type: 'error', message: err.message || 'Retry attempt failed.' });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleExecuteClear = async (params) => {
    setIsClearing(true);
    try {
      const res = await api.clearHistory(params);
      if (res.success) {
        setRetryFeedback({
          type: 'success',
          message: res.message || 'Execution history cleared successfully.'
        });
        setIsClearModalOpen(false);
        setPage(1);
        fetchHistory();
      }
    } catch (err) {
      setRetryFeedback({
        type: 'error',
        message: err.message || 'Failed to clear execution history.'
      });
      setIsClearModalOpen(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Retry Feedback Toast */}
      {retryFeedback && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between ${
          retryFeedback.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <span>{retryFeedback.message}</span>
          <button
            onClick={() => setRetryFeedback(null)}
            className="text-xs font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full md:w-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by schedule name, recipient phone, or message text..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Statuses</option>
            <option value="accepted">Accepted (Success)</option>
            <option value="failed">Failed</option>
            <option value="uncertain">Uncertain Delivery</option>
            <option value="skipped">Skipped (Offline)</option>
            <option value="sending">Sending / Pending</option>
          </select>

          {/* Date range inputs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              title="Start Date"
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              title="End Date"
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            />
          </div>

          <button
            onClick={fetchHistory}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
            title="Refresh history"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsClearModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 bg-rose-50/60 hover:bg-rose-100 hover:border-rose-300 transition-colors"
            title="Clear execution history and audit logs"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Uncertainty Notice Box */}
      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold block mb-0.5">Delivery Status & Safety Notice:</span>
          An <span className="font-semibold text-emerald-800">"Accepted"</span> status signifies that WhatsApp Web received the message dispatch request. Since local web automation cannot guarantee read receipts or phone-level network delivery, transient timeouts are flagged as <span className="font-semibold text-amber-800">"Uncertain"</span> to prevent duplicate message sends.
        </div>
      </div>

      {/* Execution Logs Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          <span className="text-sm font-medium">Loading history logs...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error}
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 space-y-2">
          <Clock className="w-8 h-8 mx-auto text-slate-300" />
          <h4 className="text-sm font-bold text-slate-700">No execution logs found</h4>
          <p className="text-xs">Executed message attempts and audit logs will be displayed here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Schedule / ID</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Message Snippet</th>
                  <th className="py-3 px-4">Attempted At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">WhatsApp ID / Error</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => {
                  const canRetry = item.status === 'failed' || item.status === 'uncertain';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 text-sm">
                          {item.schedule_name || 'Schedule'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Log #{item.id} {item.schedule_id ? `(Schedule #${item.schedule_id})` : '(Deleted schedule)'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {item.recipient_phone_masked}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 truncate max-w-xs">
                        {item.message_snippet}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {new Date(item.attempted_at_utc).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3.5 px-4">
                        {item.whatsapp_message_id ? (
                          <span className="font-mono text-slate-600 truncate block max-w-[140px]" title={item.whatsapp_message_id}>
                            {item.whatsapp_message_id}
                          </span>
                        ) : item.error_message ? (
                          <span className="text-rose-600 truncate block max-w-[180px]" title={item.error_message}>
                            {item.error_message}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {canRetry && (
                          <button
                            onClick={() => setRetryTarget(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Retry sending"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Retry</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {history.length} of {total} log entries
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <span className="font-medium font-mono">Page {page}</span>
              <button
                disabled={page * 20 >= total}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retry Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(retryTarget)}
        title={retryTarget?.status === 'uncertain' ? 'Warning: Retry Uncertain Delivery' : 'Retry Message Send'}
        message={
          retryTarget?.status === 'uncertain'
            ? `The previous send attempt for "${retryTarget?.schedule_name}" finished with UNCERTAIN status because the server timed out while waiting for WhatsApp Web. Retrying might send a duplicate message if WhatsApp already accepted it. Are you sure you want to proceed?`
            : `Are you sure you want to resend message attempt #${retryTarget?.id} to ${retryTarget?.recipient_phone_masked}?`
        }
        confirmText={isRetrying ? 'Retrying...' : 'Send Message Now'}
        isWarning={retryTarget?.status === 'uncertain'}
        onConfirm={handleExecuteRetry}
        onCancel={() => setRetryTarget(null)}
      />

      {/* Clear Execution History & Audit Logs Modal */}
      <ClearHistoryModal
        isOpen={isClearModalOpen}
        totalLogs={total}
        onConfirm={handleExecuteClear}
        onCancel={() => setIsClearModalOpen(false)}
        isClearing={isClearing}
      />
    </div>
  );
}

export default HistoryPage;
