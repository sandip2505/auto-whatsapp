import React, { useState } from 'react';
import ScheduleForm from '../components/Schedules/ScheduleForm.jsx';
import api from '../services/api.js';

export function EditSchedulePage({ schedule, setCurrentTab }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!schedule) {
    return (
      <div className="py-20 text-center text-slate-500">
        <p className="text-sm">No schedule selected for editing.</p>
        <button
          onClick={() => setCurrentTab('schedules')}
          className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
        >
          Return to Schedules
        </button>
      </div>
    );
  }

  const handleSubmit = async (payload) => {
    setIsSubmitting(true);
    try {
      const res = await api.updateSchedule(schedule.id, payload);
      if (res.success) {
        setCurrentTab('schedules');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-slate-200/80 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Edit Schedule #{schedule.id}: {schedule.name || 'Untitled'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Updating schedule timing automatically re-syncs the scheduler without creating duplicate triggers.
          </p>
        </div>
        <button
          onClick={() => setCurrentTab('schedules')}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
        >
          Cancel & Return
        </button>
      </div>

      <ScheduleForm
        initialData={schedule}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

export default EditSchedulePage;
