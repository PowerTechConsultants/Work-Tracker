'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { listenOnSocket } from '@/lib/socket';
import { Bell, Check, CheckCheck, Trash2, X, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { ExportColumn } from '@/components/ExportDialog';

const ExportDialog = dynamic(() => import('@/components/ExportDialog'), { ssr: false });

const QK = ['notifications'];

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);
  const [error, setError] = useState('');

  const exportColumns: ExportColumn[] = [
    { id: 'title', label: 'Title' },
    { id: 'message', label: 'Message' },
    { id: 'type', label: 'Type' },
    { id: 'createdAt', label: 'Created At' },
  ];

  const { data, isError } = useQuery({ queryKey: QK, queryFn: async () => (await api.get('/notifications', { params: { limit: 50 } })).data, enabled: !loading && !!user });

  useEffect(() => {
    return listenOnSocket({
      'notification:new': () => { qc.invalidateQueries({ queryKey: QK }); },
    });
  }, [qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => (await api.post(`/notifications/${id}/read`)).data,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData(QK);
      qc.setQueryData(QK, (old: any) => {
        if (!old?.notifications) return old;
        return { ...old, notifications: old.notifications.map((n: any) => n.id === id ? { ...n, isRead: true } : n) };
      });
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(QK, ctx.prev); setError('Failed to mark as read'); },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const markAll = useMutation({
    mutationFn: async () => (await api.post('/notifications/read-all')).data,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData(QK);
      qc.setQueryData(QK, (old: any) => {
        if (!old?.notifications) return old;
        return { ...old, notifications: old.notifications.map((n: any) => ({ ...n, isRead: true })) };
      });
      return { prev };
    },
    onError: (_e, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(QK, ctx.prev); setError('Failed to mark all as read'); },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const deleteNotif = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/notifications/${id}`)).data,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData(QK);
      qc.setQueryData(QK, (old: any) => {
        if (!old?.notifications) return old;
        return { ...old, notifications: old.notifications.filter((n: any) => n.id !== id) };
      });
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(QK, ctx.prev); setError('Failed to delete notification'); },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const deleteSelected = useMutation({
    mutationFn: async () => {
      for (const id of selectedIds) await api.delete(`/notifications/${id}`);
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData(QK);
      qc.setQueryData(QK, (old: any) => {
        if (!old?.notifications) return old;
        return { ...old, notifications: old.notifications.filter((n: any) => !selectedIds.has(n.id)) };
      });
      return { prev };
    },
    onSuccess: () => { setSelectedIds(new Set()); setSelectMode(false); },
    onError: (_e, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(QK, ctx.prev); setError('Failed to delete selected'); },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {isError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl px-4 py-3">
            Failed to load notifications. Refresh to try again.
          </div>
        )}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <div className="flex gap-2">
            {selectMode ? (
              <>
                <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                  className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 text-sm font-medium transition border border-slate-700">
                  <X className="h-4 w-4" />Cancel
                </button>
                <button onClick={() => deleteSelected.mutate()} disabled={selectedIds.size === 0 || deleteSelected.isPending}
                  className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-medium transition disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />Delete ({selectedIds.size})
                </button>
              </>
            ) : (
              <>
                {data?.notifications?.length > 0 && (
                  <button onClick={() => setShowExport(true)}
                    className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 text-sm font-medium transition border border-slate-700">
                    <Download className="h-4 w-4" />Export
                  </button>
                )}
                {data?.notifications?.length > 0 && (
                  <button onClick={() => setSelectMode(true)}
                    className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 text-sm font-medium transition border border-slate-700">
                    <Trash2 className="h-4 w-4" />Select
                  </button>
                )}
                {(data?.unreadCount ?? 0) > 0 && (
                  <button onClick={() => markAll.mutate()} className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 text-sm font-medium transition border border-slate-700">
                    <CheckCheck className="h-4 w-4" />Mark all read
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {data?.notifications?.map((n: any) => (
            <div key={n.id} className={`flex items-start gap-4 p-4 rounded-2xl border transition ${n.isRead ? 'bg-slate-900/50 border-slate-800/50' : 'bg-slate-900 border-slate-700'}`}>
              {selectMode && (
                <input type="checkbox" checked={selectedIds.has(n.id)} onChange={() => toggleSelect(n.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-violet-600 focus:ring-violet-500" />
              )}
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' : n.type === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{n.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                <p className="text-xs text-slate-500 mt-1">{formatDateTime(n.createdAt)}</p>
              </div>
              {!selectMode && !n.isRead && (
                <button onClick={() => markRead.mutate(n.id)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition flex-shrink-0">
                  <Check className="h-4 w-4" />
                </button>
              )}
              {selectMode && (
                <button onClick={() => deleteNotif.mutate(n.id)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {(!data?.notifications || data.notifications.length === 0) && (
            <div className="text-center py-12 text-slate-500"><Bell className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No notifications</p></div>
          )}
        </div>

        <ExportDialog
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          data={data?.notifications ?? []}
          columns={exportColumns}
          filename="notifications"
          title="Notifications Export"
        />
      </div>
    </DashboardLayout>
  );
}
