'use client';

import { useState } from 'react';
import { Download, Loader2, ChevronDown } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { exportAllDataToExcel, exportAllDataToPDF, exportAllDataToCSV, type ExportAllData } from '@/lib/utils';

const PAGE_SIZE = 100;

export default function ExportAllButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchList = async (url: string, params: any, extract: (d: any) => any[]) => {
    const all: any[] = [];
    let page = 1;
    try {
      while (true) {
        const res = await api.get(url, { params: { ...params, page, limit: PAGE_SIZE } });
        const data = res.data;
        const items = extract(data) ?? [];
        all.push(...items);
        const total = data?.total;
        if (typeof total !== 'number' || all.length >= total || items.length === 0) break;
        page++;
      }
    } catch {
      // skip a module entirely if it fails rather than aborting the whole export
    }
    return all;
  };

  const fetchAttendanceEvents = async (records: any[]) => {
    const rows: any[] = [];
    if (!records?.length) return rows;
    const chunkSize = 5;
    for (let i = 0; i < records.length; i += chunkSize) {
      const slice = records.slice(i, i + chunkSize);
      const results = await Promise.all(slice.map(async (rec: any) => {
        try {
          const res = await api.get(`/attendance/events/${rec.id}`);
          const events = res.data?.events ?? [];
          return events.map((ev: any) => ({
            employee_id: rec.employee_id,
            first_name: rec.first_name,
            last_name: rec.last_name,
            date: rec.date,
            event_type: ev.event_type,
            occurred_at: ev.occurred_at,
            latitude: ev.latitude,
            longitude: ev.longitude,
            location_accuracy: ev.location_accuracy,
            location_captured_at: ev.location_captured_at,
          }));
        } catch {
          return [];
        }
      }));
      for (const arr of results) rows.push(...arr);
    }
    return rows;
  };

  const fetchAllData = async (): Promise<ExportAllData> => {
    const hasStart = !!startDate;
    const hasEnd = !!endDate;

    const [attendance, tasks, leaves, users, departments, teams, holidays, planSlots, reportSlots] = await Promise.all([
      fetchList('/attendance', { ...(hasStart ? { startDate } : {}), ...(hasEnd ? { endDate } : {}) }, (d: any) => d?.records ?? []),
      fetchList('/tasks', { ...(hasStart ? { dueAfter: startDate } : {}), ...(hasEnd ? { dueBefore: endDate } : {}) }, (d: any) => d?.tasks ?? []),
      fetchList('/leaves', { ...(hasStart ? { startDate } : {}), ...(hasEnd ? { endDate } : {}) }, (d: any) => d?.leaves ?? []),
      fetchList('/users', {}, (d: any) => d?.users ?? []),
      (async () => { try { return (await api.get('/departments')).data ?? []; } catch { return []; } })(),
      (async () => { try { return (await api.get('/teams')).data ?? []; } catch { return []; } })(),
      fetchList('/holidays', { limit: PAGE_SIZE }, (d: any) => d?.holidays ?? []),
      (async () => { try { return (await api.get('/plans/slots')).data ?? []; } catch { return []; } })(),
      (async () => { try { return (await api.get('/reports/slots')).data ?? []; } catch { return []; } })(),
    ]);

    const allPlanPromises = planSlots
      .filter((s: any) => s.totalPlans > 0)
      .map(async (s: any) => {
        const params = { userId: s.userId, ...(hasStart ? { startDate } : {}), ...(hasEnd ? { endDate } : {}) };
        try {
          const res = await api.get('/plans/export', { params });
          return { employeeName: `${s.firstName} ${s.lastName}`, plans: res.data ?? [] };
        } catch {
          return { employeeName: `${s.firstName} ${s.lastName}`, plans: [] };
        }
      });

    const allReportPromises = reportSlots
      .filter((s: any) => s.totalReports > 0)
      .map(async (s: any) => {
        const params = { userId: s.userId, ...(hasStart ? { startDate } : {}), ...(hasEnd ? { endDate } : {}) };
        try {
          const res = await api.get('/reports/export', { params });
          return { employeeName: `${s.firstName} ${s.lastName}`, reports: res.data ?? [] };
        } catch {
          return { employeeName: `${s.firstName} ${s.lastName}`, reports: [] };
        }
      });

    const [plans, reports] = await Promise.all([
      Promise.all(allPlanPromises),
      Promise.all(allReportPromises),
    ]);

    const attendanceEvents = await fetchAttendanceEvents(attendance);

    return { planSlots, reportSlots, plans, reports, attendance, attendanceEvents, tasks, leaves, users, departments, teams, holidays };
  };

  const handleExport = async (format: 'xlsx' | 'pdf' | 'csv') => {
    setLoading(true);
    setError('');
    setSuccess('');
    setOpen(false);
    try {
      const allData = await fetchAllData();
      const date = new Date().toISOString().split('T')[0];
      const baseName = `work-tracker-export-${date}`;
      if (format === 'pdf') await exportAllDataToPDF(allData, baseName);
      else if (format === 'csv') exportAllDataToCSV(allData, baseName);
      else await exportAllDataToExcel(allData, baseName);
      setSuccess('Export downloaded!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(getApiError(e, 'Export failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex items-center">
        <button
          onClick={() => handleExport('xlsx')}
          disabled={loading}
          className="flex items-center gap-2 rounded-l-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export All
        </button>
        <button
          onClick={() => setOpen(!open)}
          disabled={loading}
          className="rounded-r-xl bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-2.5 transition disabled:opacity-50 border-l border-emerald-500"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-4 bottom-4 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-3 overflow-y-auto flex flex-col gap-3 max-h-[80vh] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:bottom-auto sm:w-72 sm:block">
            <div className="px-1 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-700 pb-2">Export all data</div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-400">Date range (optional — empty = all data)</span>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex flex-col gap-1">
                  <span className="text-xs text-slate-500">From</span>
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
                <label className="flex-1 flex flex-col gap-1">
                  <span className="text-xs text-slate-500">To</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="self-start text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Clear (export all data)
                </button>
              )}
            </div>

            <div className="flex flex-col border-t border-slate-700 pt-2">
              <button onClick={() => handleExport('xlsx')} className="w-full text-left px-2 py-3 sm:py-2 text-sm text-slate-200 hover:bg-slate-700 transition rounded-lg">Excel (.xlsx)</button>
              <button onClick={() => handleExport('pdf')} className="w-full text-left px-2 py-3 sm:py-2 text-sm text-slate-200 hover:bg-slate-700 transition rounded-lg">PDF (.pdf)</button>
              <button onClick={() => handleExport('csv')} className="w-full text-left px-2 py-3 sm:py-2 text-sm text-slate-200 hover:bg-slate-700 transition rounded-lg">CSV (.csv)</button>
            </div>
          </div>
        </>
      )}
      {error && <span className="text-xs text-rose-400">{error}</span>}
      {success && <span className="text-xs text-emerald-400">{success}</span>}
    </div>
  );
}
