import React, { useState, useEffect } from 'react';
import { Plus, Clock, Globe } from 'lucide-react';
import StatusBadge from '../Common/StatusBadge.jsx';

export function Header({ currentTab, setCurrentTab, whatsappStatus, timezone = 'Asia/Kolkata' }) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    function updateClock() {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }).format(now);
        setTimeStr(formatted);
      } catch {
        setTimeStr(new Date().toLocaleTimeString());
      }
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  const titles = {
    dashboard: 'Dashboard Overview',
    schedules: 'Scheduled Messages',
    create: 'Create Message Schedule',
    edit: 'Edit Schedule',
    history: 'Execution History & Audit Logs',
    whatsapp: 'WhatsApp Connection & Device Pairing',
    settings: 'Preferences & System Settings'
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-lg font-bold text-slate-800">{titles[currentTab] || 'WhatsApp Scheduler'}</h2>
      </div>

      <div className="flex items-center gap-5">
        {/* Real-time timezone clock */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs font-medium text-slate-600">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span>{timezone}</span>
          <span className="text-slate-300">|</span>
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-slate-800 font-semibold">{timeStr}</span>
        </div>

        {/* WhatsApp connection pill */}
        <div className="flex items-center gap-2">
          <StatusBadge status={whatsappStatus?.status} type="whatsapp" />
        </div>

        {/* Quick action button */}
        {currentTab !== 'create' && (
          <button
            onClick={() => setCurrentTab('create')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-emerald-200"
          >
            <Plus className="w-4 h-4" />
            <span>New Schedule</span>
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
