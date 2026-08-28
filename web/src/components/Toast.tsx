'use client';

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        className: 'text-sm',
        style: {
          background: '#1e293b',
          color: '#e2e8f0',
          border: '1px solid #334155',
        },
      }}
    />
  );
}
