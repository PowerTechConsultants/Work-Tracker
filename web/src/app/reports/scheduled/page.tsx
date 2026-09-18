'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, scheduledReportsApi, reportTemplatesApi, getApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useState } from 'react';
import { Plus, Loader2, Trash2, Play, Clock, ChevronDown, ChevronUp, CalendarClock, X } from 'lucide-react';
import Modal from '@/components/Modal';

interface ScheduleForm {
  templateId: string;
  recipients: string[];
  cronExpression: string;
  format: string;
  active: boolean;
}

const emptyForm: ScheduleForm = { templateId: '', recipients: [], cronExpression: '0 9 * * 1', format: 'pdf', active: true };

function cronToHuman(expr: string): string {
  if (!expr) return '';
  const parts = expr.split(' ');
  if (parts.length !== 5) return expr;
  const [min, hour, , , dow] = parts;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const h = parseInt(hour, 10);
  const m = parseInt(min, 10);
  const time = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  if (dow === '*' && parts[2] === '*') return `Daily at ${time}`;
  if (dow !== '*' && parts[2] === '*') return `Every ${days[parseInt(dow, 10)]} at ${time}`;
  if (parts[2] !== '*' && dow === '*') return `Day ${parts[2]} of month at ${time}`;
  return expr;
}

export default function ScheduledReportsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState<string | null>(null);
  const [recipientInput, setRecipientInput] = useState('');

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['scheduledReports'],
    queryFn: async () => (await scheduledReportsApi.list()).data,
    enabled: !loading && !!user,
  });

  const { data: templateData } = useQuery({
    queryKey: ['reportTemplatesList'],
    queryFn: async () => (await reportTemplatesApi.list()).data,
    enabled: !loading && !!user,
  });

  const { data: usersData } = useQuery({
    queryKey: ['usersListForSchedules'],
    queryFn: async () => (await api.get('/users?limit=100')).data,
    retry: false,
    enabled: !loading && !!user,
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['scheduledResults', expandedResults],
    queryFn: async () => (await scheduledReportsApi.results(expandedResults!)).data,
    enabled: !!expandedResults,
  });

  const createMutation = useMutation({
    mutationFn: (d: ScheduleForm) => scheduledReportsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduledReports'] }); closeModal(); },
    onError: (e) => setError(getApiError(e, 'Failed to create schedule')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: ScheduleForm }) => scheduledReportsApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduledReports'] }); closeModal(); },
    onError: (e) => setError(getApiError(e, 'Failed to update schedule')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduledReportsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduledReports'] }); setDeleteConfirm(null); },
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => scheduledReportsApi.run(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduledReports'] }),
  });

  function closeModal() { setShowModal(false); setEditId(null); setForm(emptyForm); setError(''); }

  function openCreate() { setForm(emptyForm); setEditId(null); setError(''); setShowModal(true); }

  function openEdit(s: any) {
    setForm({
      templateId: s.templateId ?? s.template_id ?? '',
      recipients: s.recipients ?? [],
      cronExpression: s.cronExpression ?? s.cron_expression ?? '0 9 * * 1',
      format: s.format ?? 'pdf',
      active: s.active ?? true,
    });
    setEditId(s.id);
    setError('');
    setShowModal(true);
  }

  function handleSubmit() {
    if (!form.templateId) { setError('Template is required'); return; }
    if (editId) updateMutation.mutate({ id: editId, data: form });
    else createMutation.mutate(form);
  }

  function addRecipient() {
    if (recipientInput && !form.recipients.includes(recipientInput)) {
      setForm(f => ({ ...f, recipients: [...f.recipients, recipientInput] }));
      setRecipientInput('');
    }
  }

  function removeRecipient(r: string) {
    setForm(f => ({ ...f, recipients: f.recipients.filter(x => x !== r) }));
  }

  const schedules = scheduleData?.schedules ?? [];
  const templates = templateData?.templates ?? [];
  const users: any[] = usersData?.users ?? [];

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-16"><div className="h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (!user || (user.role !== 'director' && user.role !== 'hr')) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-400 font-medium">Access Denied</p>
          <p className="text-xs text-slate-600 mt-1">You need director or HR permissions to access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl px-4 py-3">{error}</div>}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CalendarClock className="h-6 w-6 text-violet-400" />Scheduled Reports</h1>
          <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-semibold transition">
            <Plus className="h-4 w-4" />Create Schedule
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No scheduled reports yet.</div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Template</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Schedule</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Format</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Active</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Last Run</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s: any) => {
                    const id = s.id;
                    const tpl = templates.find((t: any) => t.id === (s.templateId ?? s.template_id));
                    const isExpanded = expandedResults === id;
                    return (
                      <tr key={id} className="border-b border-slate-800">
                        <td colSpan={6} className="p-0">
                          <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition">
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{tpl?.name ?? s.templateId ?? s.template_id}</p>
                              <p className="text-xs text-slate-500">{cronToHuman(s.cronExpression ?? s.cron_expression)}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-300">{(s.format ?? 'pdf').toUpperCase()}</span>
                              <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${s.active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/15 text-slate-400 border border-slate-500/20'}`}>
                                {s.active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-xs text-slate-500 w-28 text-right">{s.lastRunAt ? formatDateTime(s.lastRunAt) : 'Never'}</span>
                              <div className="flex items-center gap-1 ml-2">
                                <button onClick={() => runMutation.mutate(id)} disabled={runMutation.isPending}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-50" title="Run now">
                                  <Play className="h-4 w-4" />
                                </button>
                                <button onClick={() => setExpandedResults(isExpanded ? null : id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition" title="View results">
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition" title="Edit">
                                  <Clock className="h-4 w-4" />
                                </button>
                                <button onClick={() => setDeleteConfirm(id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition" title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-3 border-t border-slate-800">
                              {resultsLoading ? (
                                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
                              ) : resultsData?.results?.length > 0 ? (
                                <div className="overflow-x-auto mt-2">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-700">
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Run At</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Status</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Recipients</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">File</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {resultsData.results.map((r: any, i: number) => (
                                        <tr key={i} className="border-b border-slate-800">
                                          <td className="py-2 px-3 text-slate-300">{r.executedAt ? formatDateTime(r.executedAt) : '—'}</td>
                                          <td className="py-2 px-3">
                                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${r.status === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                                              {r.status}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-slate-400">{r.recipients?.join(', ') ?? '—'}</td>
                                          <td className="py-2 px-3 text-violet-400">{r.fileUrl ?? r.file_url ?? '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-center text-slate-500 py-4 text-xs">No results yet</p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal open={showModal} onClose={closeModal} title={editId ? 'Edit Schedule' : 'Create Schedule'} maxWidth="max-w-xl">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Template *</label>
              <select value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white">
                <option value="">Select template</option>
                {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Recipients</label>
              <div className="flex gap-2">
                <select value={recipientInput} onChange={e => setRecipientInput(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white">
                  <option value="">Select user</option>
                  {users.filter((u: any) => !form.recipients.includes(u.id)).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
                <button onClick={addRecipient} disabled={!recipientInput}
                  className="rounded-xl bg-slate-700 hover:bg-slate-600 text-white px-3 py-2.5 text-sm transition disabled:opacity-50">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {form.recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.recipients.map(r => {
                    const u = users.find((u: any) => u.id === r);
                    const label = u ? `${u.firstName} ${u.lastName}` : r;
                    return (
                      <span key={r} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/20 text-xs">
                        {label}
                        <button onClick={() => removeRecipient(r)} className="hover:text-white transition"><X className="h-3 w-3" /></button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Cron Expression</label>
              <input type="text" value={form.cronExpression} onChange={e => setForm(f => ({ ...f, cronExpression: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white font-mono" placeholder="0 9 * * 1" />
              <p className="text-xs text-slate-500 mt-1">{cronToHuman(form.cronExpression)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Format</label>
                <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white">
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Status</label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <div className={`relative w-10 h-5 rounded-full transition ${form.active ? 'bg-violet-600' : 'bg-slate-700'}`}
                    onClick={() => setForm(f => ({ ...f, active: !f.active }))}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.active ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-slate-300">{form.active ? 'Active' : 'Inactive'}</span>
                </label>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white py-2.5 text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? 'Update Schedule' : 'Create Schedule'}
            </button>
          </div>
        </Modal>

        <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Schedule">
          <p className="text-sm text-slate-300 mb-4">Are you sure you want to delete this schedule?</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white py-2.5 text-sm font-medium transition">Cancel</button>
            <button onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}
              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-2.5 text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Delete
            </button>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
