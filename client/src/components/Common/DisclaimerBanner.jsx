import React, { useState } from 'react';
import { ShieldAlert, ExternalLink, X } from 'lucide-react';

export function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 text-xs text-amber-900 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="leading-normal">
            <span className="font-semibold">Notice:</span> This local tool uses unofficial WhatsApp Web automation (`whatsapp-web.js`). Messaging may be subject to WhatsApp restrictions or account terms. Never use for unsolicited messages. Review the{' '}
            <a
              href="https://www.whatsapp.com/legal/terms-of-service"
              target="_blank"
              rel="noreferrer"
              className="underline font-medium hover:text-amber-950 inline-flex items-center gap-0.5"
            >
              WhatsApp Terms of Service <ExternalLink className="w-3 h-3" />
            </a>{' '}
            and{' '}
            <a
              href="https://www.whatsapp.com/legal/business-messaging-policy"
              target="_blank"
              rel="noreferrer"
              className="underline font-medium hover:text-amber-950 inline-flex items-center gap-0.5"
            >
              Messaging Guidelines <ExternalLink className="w-3 h-3" />
            </a>.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-700 hover:text-amber-900 p-1 rounded hover:bg-amber-100 shrink-0"
          title="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default DisclaimerBanner;
