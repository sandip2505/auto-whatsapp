import React, { useState, useEffect } from 'react';
import Layout from './components/Layout/Layout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SchedulesPage from './pages/SchedulesPage.jsx';
import CreateSchedulePage from './pages/CreateSchedulePage.jsx';
import EditSchedulePage from './pages/EditSchedulePage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import WhatsAppConnectionPage from './pages/WhatsAppConnectionPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import api from './services/api.js';

export function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Fetch initial WhatsApp status and settings
  const refreshWhatsAppStatus = async () => {
    try {
      const res = await api.getWhatsAppStatus();
      if (res.success) {
        setWhatsappStatus(res.data);
      }
    } catch (err) {
      console.warn('Could not query WhatsApp status:', err.message);
    }
  };

  const loadInitialSettings = async () => {
    try {
      const res = await api.getSettings();
      if (res.success && res.data?.settings?.default_timezone) {
        setTimezone(res.data.settings.default_timezone);
      }
    } catch (err) {
      console.warn('Could not load initial settings:', err.message);
    }
  };

  useEffect(() => {
    refreshWhatsAppStatus();
    loadInitialSettings();
    const interval = setInterval(refreshWhatsAppStatus, 7000); // Poll status every 7s
    return () => clearInterval(interval);
  }, []);

  const handleSelectScheduleForEdit = (schedule) => {
    setEditingSchedule(schedule);
    setCurrentTab('edit');
  };

  return (
    <Layout
      currentTab={currentTab}
      setCurrentTab={(tab) => {
        if (tab !== 'edit') setEditingSchedule(null);
        setCurrentTab(tab);
      }}
      whatsappStatus={whatsappStatus}
      timezone={timezone}
    >
      {currentTab === 'dashboard' && (
        <DashboardPage
          setCurrentTab={setCurrentTab}
          onSelectScheduleForEdit={handleSelectScheduleForEdit}
        />
      )}
      {currentTab === 'schedules' && (
        <SchedulesPage
          setCurrentTab={setCurrentTab}
          onSelectScheduleForEdit={handleSelectScheduleForEdit}
        />
      )}
      {currentTab === 'create' && (
        <CreateSchedulePage setCurrentTab={setCurrentTab} />
      )}
      {currentTab === 'edit' && (
        <EditSchedulePage
          schedule={editingSchedule}
          setCurrentTab={setCurrentTab}
        />
      )}
      {currentTab === 'history' && <HistoryPage />}
      {currentTab === 'whatsapp' && (
        <WhatsAppConnectionPage
          whatsappStatus={whatsappStatus}
          onRefreshStatus={refreshWhatsAppStatus}
        />
      )}
      {currentTab === 'settings' && (
        <SettingsPage onSettingsUpdated={(newTz) => setTimezone(newTz)} />
      )}
    </Layout>
  );
}

export default App;
