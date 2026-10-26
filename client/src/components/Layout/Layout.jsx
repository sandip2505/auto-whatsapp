import React from 'react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import DisclaimerBanner from '../Common/DisclaimerBanner.jsx';

export function Layout({ children, currentTab, setCurrentTab, whatsappStatus, timezone }) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        whatsappStatus={whatsappStatus}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          whatsappStatus={whatsappStatus}
          timezone={timezone}
        />
        <DisclaimerBanner />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
