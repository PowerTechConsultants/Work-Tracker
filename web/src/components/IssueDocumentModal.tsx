'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { DOC_TEMPLATES, documentPdfPreviewUrl } from '@/lib/documentTemplates';
import type { DocumentRequest } from '@/types/api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function buildInitialFields(doc: DocumentRequest): Record<string, any> {
  const snapshot: Record<string, string> = {
    name: `${doc.firstName} ${doc.lastName}`.trim(),
    employeeId: doc.employeeId ?? '',
    designation: doc.designation ?? '',
    department: doc.departmentName ?? '',
    joiningDate: (doc.joiningDate ?? '').split('T')[0] ?? '',
  };
  const now = new Date();
  const next: Record<string, any> = {};
  const template = DOC_TEMPLATES[doc.docType];
  if (!template) return next;
  for (const fdef of template.fields) {
    next[fdef.key] = fdef.prefill ? (snapshot[fdef.prefill] ?? '') : '';
  }
  if (doc.docType === 'appointment_letter') next.probationMonths = 6;
  if (doc.docType === 'salary_slip') {
    next.month = MONTHS[now.getMonth()];
    next.year = now.getFullYear();
    next.paidDays = 30;
    next.lopDays = 0;
  }
  return next;
}

interface IssueDocumentModalProps {
  doc: DocumentRequest;
  onClose: () => void;
}

// Boilerplate fill-and-issue form used by /documents and /employee-database.
// Employee fields are prefilled from the record; HR/Admin complete the rest,
// optionally preview the PDF and submit to issue it to the employee.
export default function IssueDocumentModal({ doc, onClose }: IssueDocumentModalProps) {
  const qc = useQueryClient();
  const template = DOC_TEMPLATES[doc.docType];
  const [fields, setFields] = useState<Record<string, any>>(() => buildInitialFields(doc));
  const [showPreview, setShowPreview] = useState(false);

  const setField = (key: string, value: any) => setFields((prev) => ({ ...prev, [key]: value }));

  const previewUrl = useMemo(() => {
    if (!showPreview) return null;
    try {
      return documentPdfPreviewUrl({
        docType: doc.docType,
        fields,
        docNumber: 'PREVIEW',
        issueDate: new Date().toISOString(),
        issuedBy: null,
      });
    } catch {
      return null;
    }
  }, [showPreview, doc.docType, fields]);

  const issueMutation = useMutation({
    mutationFn: async (input: { id: string; fields: Record<string, any> }) =>
      (await api.post(`/documents/${input.id}/issue`, { fields: input.fields })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document issued. The employee has been notified and can download it.');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to issue document'),
  });

  if (!template) return null;

  return (
    <Modal open onClose={onClose} title={`Fill & Issue — ${template.label}`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
          <p className="text-sm text-violet-200 font-medium">{template.description}</p>
          <p className="text-xs text-slate-400 mt-1">
            For: {doc.firstName} {doc.lastName} ({doc.employeeId}) · prefilled fields come from the employee record — edit if needed.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {template.fields.map((f) => (
            <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={2}
                  placeholder={f.placeholder ?? ''}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              ) : f.type === 'select' && f.options ? (
                <select
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">Select...</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder ?? ''}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              )}
            </div>
          ))}
        </div>

        {showPreview && (
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
            {previewUrl ? (
              <iframe src={previewUrl} title="Document preview" className="w-full h-[420px]" />
            ) : (
              <p className="p-4 text-sm text-slate-400">Preview could not be generated.</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition">Cancel</button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2.5 text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition"
          >
            {showPreview ? 'Hide Preview' : 'Preview PDF'}
          </button>
          <button
            disabled={issueMutation.isPending}
            onClick={() => issueMutation.mutate({ id: doc.id, fields })}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition disabled:opacity-50"
          >
            {issueMutation.isPending ? 'Issuing...' : 'Submit & Issue to Employee'}
          </button>
        </div>
      </div>
    </Modal>
  );
}