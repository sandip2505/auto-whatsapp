import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Play,
  Pause,
  Trash2,
  Copy,
  Edit,
  Eye,
  Calendar,
  Clock,
  Phone,
  User,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import api from '../services/api.js';
import StatusBadge from '../components/Common/StatusBadge.jsx';
import ConfirmModal from '../components/Common/ConfirmModal.jsx';
import ScheduleDetailsModal from '../components/Schedules/ScheduleDetailsModal.jsx';

export function SchedulesPage({ setCurrentTab, onSelectScheduleForEdit }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSchedules({
        search: searchTerm,
        status: statusFilter,
        type: typeFilter,
        page,
        limit: 15
      });
      if (res.success) {
        setSchedules(res.data.schedules);
        setTotal(res.data.total);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch schedules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [searchTerm, statusFilter, typeFilter, page]);

  // Handle Pause/Resume
  const handleToggleStatus = async (schedule) => {
    try {
      const newEnabled = schedule.enabled ? 0 : 1;
      const newStatus = newEnabled ? 'active' : 'paused';
      await api.updateScheduleStatus(schedule.id, newEnabled, newStatus);
      fetchSchedules();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // Handle Duplicate
  const handleDuplicate = async (scheduleId) => {
    try {
      await api.duplicateSchedule(scheduleId);
      fetchSchedules();
    } catch (err) {
      alert(`Failed to duplicate schedule: ${err.message}`);
    }
  };

  // Handle Delete Confirmed
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setActionInProgress(true);
      await api.deleteSchedule(deleteTarget.id);
      setDeleteTarget(null);
      fetchSchedules();
    } catch (err) {
      alert(`Failed to delete schedule: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full md:w-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone (+91...), or message..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Types</option>
            <option value="one_time">One-time</option>
            <option value="interval">Interval (Hrs & Mins)</option>
            <option value="every_10_minutes">Every 10 Mins</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          <button
            onClick={fetchSchedules}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setCurrentTab('create')}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* Schedules List Table / Cards */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          <span className="text-sm font-medium">Loading schedules...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 space-y-3">
          <Calendar className="w-10 h-10 mx-auto text-slate-300" />
          <h4 className="text-base font-bold text-slate-700">No message schedules found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || statusFilter || typeFilter
              ? 'Try modifying your search query or filter settings.'
              : 'Create your first one-time or recurring WhatsApp message schedule.'}
          </p>
          <button
            onClick={() => setCurrentTab('create')}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-200"
          >
            <Plus className="w-4 h-4" />
            <span>New Schedule</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Name / Recipient</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Next Run</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 text-sm">
                        {schedule.name || 'Untitled'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {schedule.recipient_name || 'No recipient name'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {schedule.phone_number}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 truncate max-w-xs">
                      <span>{schedule.message}</span>
                      {schedule.recurrence_config?.autoIncrement && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          #{schedule.recurrence_config.currentCount ?? schedule.recurrence_config.startCount ?? 1}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {schedule.schedule_type === 'interval' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          {(() => {
                            const config = schedule.recurrence_config || {};
                            const h = parseInt(config.intervalHours || 0, 10);
                            const m = parseInt(config.intervalMinutes || 0, 10);
                            const s = parseInt(config.intervalSeconds || 0, 10);
                            const parts = [];
                            if (h > 0) parts.push(`${h}h`);
                            if (m > 0) parts.push(`${m}m`);
                            if (s > 0) parts.push(`${s}s`);
                            const dur = parseFloat(config.durationHours);
                            const intervalStr = parts.length > 0 ? `Every ${parts.join(' ')}` : 'Every 10m';
                            return !isNaN(dur) && dur > 0 ? `${intervalStr} (${dur}h)` : intervalStr;
                          })()}
                        </span>
                      ) : schedule.schedule_type === 'every_10_minutes' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          Every 10 Mins
                        </span>
                      ) : (
                        <span className="capitalize px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {schedule.schedule_type.replace(/_/g, '-')}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {schedule.next_run_formatted ? (
                        <span className="font-mono text-emerald-800 font-medium">
                          {schedule.next_run_formatted}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={schedule.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {/* Details Modal */}
                        <button
                          onClick={() => setDetailsTarget(schedule)}
                          title="View Details"
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Toggle Pause/Resume */}
                        {schedule.status !== 'completed' && (
                          <button
                            onClick={() => handleToggleStatus(schedule)}
                            title={schedule.enabled ? 'Pause Schedule' : 'Resume Schedule'}
                            className={`p-1.5 rounded-lg hover:bg-slate-100 ${
                              schedule.enabled
                                ? 'text-amber-500 hover:text-amber-600'
                                : 'text-emerald-600 hover:text-emerald-700'
                            }`}
                          >
                            {schedule.enabled ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          onClick={() => onSelectScheduleForEdit(schedule)}
                          title="Edit Schedule"
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Duplicate */}
                        <button
                          onClick={() => handleDuplicate(schedule.id)}
                          title="Duplicate Schedule"
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(schedule)}
                          title="Delete Schedule"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {schedules.length} of {total} schedules
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
                disabled={page * 15 >= total}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Message Schedule"
        message={`Are you sure you want to delete "${deleteTarget?.name || 'this schedule'}"? Future executions will be cancelled immediately.`}
        confirmText={actionInProgress ? 'Deleting...' : 'Delete Schedule'}
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        <p className="mt-2 text-xs text-slate-500 italic">
          Historical execution logs for this schedule will be preserved for auditing.
        </p>
      </ConfirmModal>

      {/* Schedule Details Drawer/Modal */}
      <ScheduleDetailsModal
        schedule={detailsTarget}
        isOpen={Boolean(detailsTarget)}
        onClose={() => setDetailsTarget(null)}
      />
    </div>
  );
}

export default SchedulesPage;
