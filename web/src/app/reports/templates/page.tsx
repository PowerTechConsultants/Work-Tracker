'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportTemplatesApi, getApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';
import { Plus, Loader2, Trash2, Edit2, FileText, X } from 'lucide-react';
import Modal from '@/components/Modal';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  required: boolean;
}

interface TemplateForm {
  name: string;
  description: string;
  type: string;
  fields: FieldDef[];
}

const emptyForm: TemplateForm = { name: '', description: '', type: 'daily', fields: [{ key: '', label: '', type: 'text', required: true }] };

export default function ReportTemplatesPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reportTemplates'],
    queryFn: async () => (await reportTemplatesApi.list()).data,
    enabled: !loading && !!user,
  });

  const createMutation = useMutation({
    mutationFn: (d: TemplateForm) => reportTemplatesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reportTemplates'] }); closeModal(); },
    onError: (e) => setError(getApiError(e, 'Failed to create template')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: TemplateForm }) => reportTemplatesApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reportTemplates'] }); closeModal(); },
    onError: (e) => setError(getApiError(e, 'Failed to update template')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportTemplatesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reportTemplates'] }); setDeleteConfirm(null); },
    onError: (e) => setError(getApiError(e, 'Failed to delete')),
  });

  function closeModal() { setShowModal(false); setEditId(null); setForm(emptyForm); setError(''); }

  function openCreate() { setForm(emptyForm); setEditId(null); setError(''); setShowModal(true); }

  function openEdit(t: any) {
    setForm({
      name: t.name ?? '',
      description: t.description ?? '',
      type: t.type ?? 'daily',
      fields: t.fields?.length ? t.fields.map((f: any) => ({ key: f.key ?? '', label: f.label ?? '', type: f.type ?? 'text', required: f.required ?? false })) : [{ key: '', label: '', type: 'text', required: true }],
    });
    setEditId(t.id);
    setError('');
    setShowModal(true);
  }

  function addField() { setForm(f => ({ ...f, fields: [...f.fields, { key: '', label: '', type: 'text', required: true }] })); }

  function removeField(i: number) { setForm(f => ({ ...f, fields: f.fields.filter((_, idx) => idx !== i) })); }

  function updateField(i: number, patch: Partial<FieldDef>) {
    setForm(f => ({ ...f, fields: f.fields.map((field, idx) => idx === i ? { ...field, ...patch } : field) }));
  }

  function handleSubmit() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.fields.some(f => !f.key.trim() || !f.label.trim())) { setError('All fields must have key and label'); return; }
    if (editId) updateMutation.mutate({ id: editId, data: form });
    else createMutation.mutate(form);
  }

  const templates = data?.templates ?? [];

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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileText className="h-6 w-6 text-violet-400" />Report Templates</h1>
          <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-semibold transition">
            <Plus className="h-4 w-4" />Create Template
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No templates yet. Create one to get started.</div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Type</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Fields</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Created</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4">
                        <p className="text-white font-medium">{t.name}</p>
                        {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20">{t.type}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{t.fields?.length ?? 0}</td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{t.createdAt ? formatDate(t.createdAt) : '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal open={showModal} onClose={closeModal} title={editId ? 'Edit Template' : 'Create Template'} maxWidth="max-w-xl">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white" placeholder="Template name" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white" placeholder="Optional description" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-300 font-medium">Fields</label>
                <button onClick={addField} className="text-xs text-violet-400 hover:text-violet-300 transition flex items-center gap-1"><Plus className="h-3 w-3" />Add Field</button>
              </div>
              <div className="space-y-2">
                {form.fields.map((field, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2 border border-slate-700">
                    <input type="text" placeholder="Key" value={field.key} onChange={e => updateField(i, { key: e.target.value })}
                      className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white" />
                    <input type="text" placeholder="Label" value={field.label} onChange={e => updateField(i, { label: e.target.value })}
                      className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white" />
                    <select value={field.type} onChange={e => updateField(i, { type: e.target.value as FieldDef['type'] })}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white">
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Boolean</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap cursor-pointer">
                      <input type="checkbox" checked={field.required} onChange={e => updateField(i, { required: e.target.checked })}
                        className="rounded border-slate-600 bg-slate-700 text-violet-500 focus:ring-violet-500" />
                      Req
                    </label>
                    {form.fields.length > 1 && (
                      <button onClick={() => removeField(i)} className="p-1 text-slate-500 hover:text-rose-400 transition"><X className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white py-2.5 text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </Modal>

        <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Template">
          <p className="text-sm text-slate-300 mb-4">Are you sure you want to delete this template? This action cannot be undone.</p>
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
