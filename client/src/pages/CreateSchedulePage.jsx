import React, { useState } from 'react';
import ScheduleForm from '../components/Schedules/ScheduleForm.jsx';
import api from '../services/api.js';

export function CreateSchedulePage({ setCurrentTab }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (payload) => {
    setIsSubmitting(true);
    try {
      const res = await api.createSchedule(payload);
      if (res.success) {
        setCurrentTab('schedules');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-slate-200/80 pb-4">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Configure New Message Schedule</h2>
        <p className="text-xs text-slate-500 mt-1">
          Set up one-time or recurring WhatsApp messages linked to your personal WhatsApp account.
        </p>
      </div>

      <ScheduleForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}

export default CreateSchedulePage;
