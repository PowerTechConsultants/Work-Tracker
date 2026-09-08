'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, FileText, FileSpreadsheet, Download } from 'lucide-react';
import { formatDate, formatDateTime, exportToCSV, exportToPDF } from '@/lib/utils';

export interface ExportColumn {
  id: string;
  label: string;
}

export interface ExportExtraSection {
  title: string;
  columns: ExportColumn[];
  data: any[];
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  dateField?: string;
  extraSections?: ExportExtraSection[];
}

type ExportFormat = 'csv' | 'excel' | 'pdf';

function formatExportValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    try { return formatDateTime(str); } catch { return str; }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    try { return formatDate(str); } catch { return str; }
  }
  return str;
}

function buildExportRows(data: any[], columns: ExportColumn[], selected: Set<string>): { headers: string[]; rows: Record<string, string>[] } {
  const cols = columns.filter(c => selected.has(c.id));
  const headers = cols.map(c => c.label);
  const rows = data.map(row => {
    const obj: Record<string, string> = {};
    for (const col of cols) {
      obj[col.label] = formatExportValue(row[col.id]);
    }
    return obj;
  });
  return { headers, rows };
}

export default function ExportDialog({ isOpen, onClose, data, columns, filename, title, dateField, extraSections }: ExportDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(columns.map(c => c.id)));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [extraSelected, setExtraSelected] = useState<Record<number, Set<string>>>({});

  useEffect(() => {
    setSelectedColumns(new Set(columns.map(c => c.id)));
    setDateFrom('');
    setDateTo('');
    const init: Record<number, Set<string>> = {};
    extraSections?.forEach((s, i) => { init[i] = new Set(s.columns.map(c => c.id)); });
    setExtraSelected(init);
  }, [columns, isOpen, extraSections]);

  const allSelected = selectedColumns.size === columns.length;

  const toggleAll = useCallback(() => {
    setSelectedColumns(allSelected ? new Set() : new Set(columns.map(c => c.id)));
  }, [allSelected, columns]);

  const toggleColumn = useCallback((id: string) => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleExtraColumn = useCallback((sectionIdx: number, id: string) => {
    setExtraSelected(prev => {
      const next = { ...prev };
      const s = new Set(next[sectionIdx] ?? []);
      if (s.has(id)) s.delete(id); else s.add(id);
      next[sectionIdx] = s;
      return next;
    });
  }, []);

  const toggleExtraAll = useCallback((sectionIdx: number) => {
    setExtraSelected(prev => {
      const section = extraSections?.[sectionIdx];
      if (!section) return prev;
      const next = { ...prev };
      const cur = next[sectionIdx] ?? new Set<string>();
      next[sectionIdx] = cur.size === section.columns.length ? new Set<string>() : new Set(section.columns.map(c => c.id));
      return next;
    });
  }, [extraSections]);

  const filteredData = useMemo(() => {
    if (!dateField || (!dateFrom && !dateTo)) return data;
    return data.filter(row => {
      const val = row[dateField];
      if (!val) return true;
      const d = new Date(val).getTime();
      if (isNaN(d)) return true;
      if (dateFrom && d < new Date(dateFrom).getTime()) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59').getTime()) return false;
      return true;
    });
  }, [data, dateField, dateFrom, dateTo]);

  const { headers: mainHeaders, rows: mainRows } = useMemo(
    () => buildExportRows(filteredData, columns, selectedColumns),
    [filteredData, columns, selectedColumns]
  );

  const extraData = useMemo(() => {
    if (!extraSections) return [];
    return extraSections.map((section, i) => {
      const sel = extraSelected[i] ?? new Set(section.columns.map(c => c.id));
      return buildExportRows(section.data, section.columns, sel);
    });
  }, [extraSections, extraSelected]);

  const totalRows = mainRows.length + extraData.reduce((sum, e) => sum + e.rows.length, 0);

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (mainRows.length === 0 && extraData.every(e => e.rows.length === 0)) return;
    if (format === 'excel') {
      // Multi-sheet Excel export
      const sections: { title: string; headers: string[]; rows: any[][] }[] = [];
      if (mainRows.length > 0) {
        sections.push({
          title: title ?? filename,
          headers: mainHeaders,
          rows: mainRows.map(r => mainHeaders.map(h => r[h])),
        });
      }
      extraData.forEach((e, i) => {
        if (e.rows.length > 0 && extraSections) {
          sections.push({
            title: extraSections[i].title,
            headers: e.headers,
            rows: e.rows.map(r => e.headers.map(h => r[h])),
          });
        }
      });
      const { exportMultiSheetExcel } = await import('@/lib/utils');
      await exportMultiSheetExcel(sections, filename);
    } else if (format === 'csv') {
      const allHeaders = [...mainHeaders];
      extraData.forEach((e) => { e.headers.forEach((h: string) => { if (!allHeaders.includes(h)) allHeaders.push(h); }); });
      const allRows = [...mainRows];
      extraData.forEach((e) => {
        if (e.rows.length > 0) {
          allRows.push(...e.rows.map((r: any) => {
            const merged: any = {};
            allHeaders.forEach((h: string) => { merged[h] = r[h] ?? ''; });
            return merged;
          }));
        }
      });
      exportToCSV(allRows, filename, allHeaders);
    } else {
      await exportToPDF(mainRows, filename, mainHeaders, title);
    }
    onClose();
  }, [mainRows, mainHeaders, extraData, extraSections, filename, title, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Export {filename}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-sm text-slate-400 mb-1">Rows to export: <span className="text-white font-medium">{totalRows}</span> / {data.length + (extraSections?.reduce((s, e) => s + e.data.length, 0) ?? 0)}</p>

        <div className="space-y-5">
          {dateField && (
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-medium">Date Range</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300 font-medium">Columns</label>
              <button onClick={toggleAll} className="text-xs text-violet-400 hover:text-violet-300 transition">
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="border border-slate-700 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5">
              {columns.map(col => (
                <label key={col.id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(col.id)}
                    onChange={() => toggleColumn(col.id)}
                    className="rounded border-slate-600 bg-slate-700 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Extra Sections */}
          {extraSections?.map((section, i) => (
            <div key={section.title}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-300 font-medium">{section.title} <span className="text-xs text-slate-500">({section.data.length} rows)</span></label>
                <button onClick={() => toggleExtraAll(i)} className="text-xs text-violet-400 hover:text-violet-300 transition">
                  {(extraSelected[i]?.size ?? 0) === section.columns.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="border border-slate-700 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5">
                {section.columns.map(col => (
                  <label key={col.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={extraSelected[i]?.has(col.id) ?? true}
                      onChange={() => toggleExtraColumn(i, col.id)}
                      className="rounded border-slate-600 bg-slate-700 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-slate-300 group-hover:text-white transition">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="block text-sm text-slate-300 mb-2 font-medium">Format</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleExport('csv')}
                disabled={totalRows === 0}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 text-sm font-medium transition disabled:opacity-40"
              >
                <FileText className="h-4 w-4" /> CSV
              </button>
              <button
                onClick={() => handleExport('excel')}
                disabled={totalRows === 0}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 text-sm font-medium transition disabled:opacity-40"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={totalRows === 0}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 text-sm font-medium transition disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
