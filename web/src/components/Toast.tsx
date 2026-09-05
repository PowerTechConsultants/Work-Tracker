'use client';

import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { listenOnSocket } from '@/lib/socket';
import {
  Bell, FileText, Clock, CheckCircle, AlertCircle, Info, Settings,
} from 'lucide-react';

const NOTIFICATION_ICONS: Record<string, any> = {
  task: FileText,
  leave: Clock,
  attendance: CheckCircle,
  system: Settings,
  info: Info,
  warning: AlertCircle,
  error: AlertCircle,
  success: CheckCircle,
};

function SocketToastListener() {
  useEffect(() => {
    const off = listenOnSocket({
      'notification:new': (n: { id: string; type: string; title: string; message: string; link?: string }) => {
        const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
        toast(n.title, {
          description: n.message,
          duration: 5000,
          icon: <Icon className="h-4 w-4" />,
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
          },
        });
      },
    });
    return off;
  }, []);

  return null;
}

export function ToastProvider() {
  return (
    <>
      <SocketToastListener />
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
    </>
  );
}
