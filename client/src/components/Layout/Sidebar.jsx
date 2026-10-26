import React from 'react';
import {
  LayoutDashboard,
  CalendarClock,
  PlusCircle,
  History,
  QrCode,
  Settings,
  MessageSquareShare
} from 'lucide-react';
import StatusBadge from '../Common/StatusBadge.jsx';

export function Sidebar({ currentTab, setCurrentTab, whatsappStatus }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedules', label: 'Scheduled Messages', icon: CalendarClock },
    { id: 'create', label: 'Create Schedule', icon: PlusCircle },
    { id: 'history', label: 'Execution History', icon: History },
    { id: 'whatsapp', label: 'WhatsApp Connection', icon: QrCode },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-screen">
      {/* Brand header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
          <MessageSquareShare className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 text-sm tracking-tight">WhatsApp Scheduler</h1>
          <p className="text-[11px] text-slate-400 font-medium">Personal Automation</p>
        </div>
      </div>

      {/* Navigation items */}
      <div className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* WhatsApp status card in sidebar footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 m-3 rounded-xl border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">WhatsApp</span>
          <StatusBadge status={whatsappStatus?.status || 'disconnected'} type="whatsapp" />
        </div>
        <p className="text-xs text-slate-500 truncate mb-3">
          {whatsappStatus?.status === 'ready' && whatsappStatus?.authenticatedUser?.pushname
            ? `Active: ${whatsappStatus.authenticatedUser.pushname}`
            : whatsappStatus?.status === 'auth_required'
            ? 'Pairing required'
            : whatsappStatus?.status === 'connecting'
            ? 'Establishing connection...'
            : 'Not connected'}
        </p>
        <button
          onClick={() => setCurrentTab('whatsapp')}
          className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-2xs transition-colors text-center"
        >
          Manage Session
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
