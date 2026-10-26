import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import api from '../services/api.js';
import StatusBadge from '../components/Common/StatusBadge.jsx';
import ConfirmModal from '../components/Common/ConfirmModal.jsx';

export function WhatsAppConnectionPage({ whatsappStatus, onRefreshStatus }) {
  const [qrCodeUrl, setQrCodeUrl] = useState(whatsappStatus?.qrCodeDataUrl || null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fetchQr = async () => {
    try {
      setLoadingQr(true);
      const res = await api.getWhatsAppQr();
      if (res.success && res.data?.qrCodeDataUrl) {
        setQrCodeUrl(res.data.qrCodeDataUrl);
      } else {
        setQrCodeUrl(null);
      }
      onRefreshStatus();
    } catch (err) {
      console.error('Failed to fetch QR:', err);
    } finally {
      setLoadingQr(false);
    }
  };

  useEffect(() => {
    if (whatsappStatus?.status === 'auth_required') {
      fetchQr();
      const interval = setInterval(fetchQr, 10000); // refresh QR polling
      return () => clearInterval(interval);
    }
  }, [whatsappStatus?.status]);

  const handleReconnect = async () => {
    setReconnecting(true);
    setFeedback(null);
    try {
      await api.reconnectWhatsApp();
      setFeedback({ type: 'info', message: 'Reconnection triggered. Checking status...' });
      setTimeout(onRefreshStatus, 2000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reconnect.' });
    } finally {
      setReconnecting(false);
    }
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    setFeedback(null);
    try {
      await api.logoutWhatsApp();
      setShowLogoutModal(false);
      setQrCodeUrl(null);
      setFeedback({ type: 'success', message: 'WhatsApp session logged out and session files safely cleared.' });
      onRefreshStatus();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to logout session.' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const status = whatsappStatus?.status || 'disconnected';
  const isReady = status === 'ready';
  const isAuthRequired = status === 'auth_required';
  const isConnecting = status === 'connecting';
  const user = whatsappStatus?.authenticatedUser;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Overview */}
      <div className="border-b border-slate-200/80 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">WhatsApp Web Connection</h2>
          <p className="text-xs text-slate-500 mt-1">
            Link your personal WhatsApp account via WhatsApp Linked Devices (QR code).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshStatus}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : feedback.type === 'info'
            ? 'bg-blue-50 border border-blue-200 text-blue-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {/* Current Connection Status Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl ${
              isReady
                ? 'bg-emerald-100 text-emerald-700'
                : isAuthRequired
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">Current Session</span>
                <StatusBadge status={status} type="whatsapp" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isReady
                  ? 'Authenticated and ready to dispatch scheduled messages'
                  : isAuthRequired
                  ? 'Scan the QR code below on your phone to link device'
                  : isConnecting
                  ? 'Connecting to WhatsApp Web headless browser...'
                  : 'Client is disconnected'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isReady ? (
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect & Logout</span>
              </button>
            ) : (
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
                <span>{reconnecting ? 'Reconnecting...' : 'Reconnect Client'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Authenticated Account Details */}
        {isReady && user && (
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 font-medium block mb-1">Account Push Name</span>
              <span className="text-sm font-bold text-slate-800">{user.pushname || 'User'}</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 font-medium block mb-1">Phone Identifier</span>
              <span className="text-sm font-mono font-bold text-slate-800">{user.phone || 'Linked'}</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 font-medium block mb-1">Session Storage</span>
              <span className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                LocalAuth (Private)
              </span>
            </div>
          </div>
        )}

        {/* QR Code Presentation Area */}
        {(!isReady || isAuthRequired) && (
          <div className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* QR Image Box */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl min-h-[340px]">
                {qrCodeUrl ? (
                  <div className="space-y-3 text-center">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 inline-block">
                      <img
                        src={qrCodeUrl}
                        alt="WhatsApp Web Login QR Code"
                        className="w-64 h-64 rounded-lg object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                      <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                      <span>Code refreshes automatically</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <QrCode className="w-12 h-12 mx-auto text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">QR Code Waiting</p>
                    <p className="text-xs text-slate-400 max-w-xs">
                      {isConnecting
                        ? 'Launching headless Chromium instance... The QR code will appear here momentarily.'
                        : 'Click "Reconnect Client" above to initiate a new pairing session.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Instructions on linking */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-600" />
                  How to link your WhatsApp account:
                </h3>
                <ol className="space-y-3 text-xs text-slate-600 list-decimal list-inside leading-relaxed">
                  <li>
                    Open <span className="font-semibold text-slate-800">WhatsApp</span> on your primary mobile phone.
                  </li>
                  <li>
                    Tap <span className="font-semibold text-slate-800">Settings</span> (iOS) or the three-dots menu <span className="font-semibold text-slate-800">⋮</span> (Android).
                  </li>
                  <li>
                    Select <span className="font-semibold text-slate-800">Linked Devices</span>, then tap <span className="font-semibold text-slate-800">Link a Device</span>.
                  </li>
                  <li>
                    Point your camera at this QR code on your computer screen to scan and pair.
                  </li>
                </ol>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-700 block">Security & Privacy:</span>
                  <p>
                    Your session is saved only on your local machine in <code className="font-mono text-slate-700">./data/whatsapp_session</code>. This application never asks for or stores your WhatsApp password, pin, or private chat histories.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Terms & Guidelines Disclaimer Card */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 text-xs text-amber-950 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          Important Usage Information & Terms
        </div>
        <p className="leading-relaxed">
          This local tool provides convenient personal message scheduling through WhatsApp Web automation. WhatsApp does not officially endorse unofficial browser clients. To protect your phone number against temporary restrictions, do not use this software for bulk unsolicited messaging or spam.
        </p>
        <div className="flex items-center gap-4 pt-1 font-semibold text-amber-800">
          <a
            href="https://www.whatsapp.com/legal/terms-of-service"
            target="_blank"
            rel="noreferrer"
            className="hover:underline flex items-center gap-1"
          >
            WhatsApp Terms of Service <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://www.whatsapp.com/legal/business-messaging-policy"
            target="_blank"
            rel="noreferrer"
            className="hover:underline flex items-center gap-1"
          >
            Messaging Policies <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmModal
        isOpen={showLogoutModal}
        title="Disconnect WhatsApp Session"
        message="Are you sure you want to disconnect? This will close the WhatsApp Web session and clear local credentials from your computer. You will need to scan the QR code again to schedule future messages."
        confirmText={isLoggingOut ? 'Logging out...' : 'Confirm Disconnect'}
        isDestructive={true}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  );
}

export default WhatsAppConnectionPage;
