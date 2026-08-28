'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: string;
  key: string;
  className?: string;
  headerClassName?: string;
  render: (row: T) => React.ReactNode;
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  actions?: (row: T) => React.ReactNode;
  mobileTitle?: (row: T) => React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
}

export default function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  actions,
  mobileTitle,
  empty,
  className,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn('bg-slate-900 border border-slate-800 rounded-2xl', className)}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {empty ?? (
            <>
              <p className="text-sm text-slate-400">No entries found</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl', className)}>
      {/* Desktop: table */}
      <div className="hidden md:block overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={cn('px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap', c.headerClassName)}
                  >
                    {c.header}
                  </th>
                ))}
                {actions && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-slate-800/40 transition">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3 text-slate-300', c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <div
            key={rowKey(row)}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4"
          >
            {mobileTitle && (
              <div className="mb-3">{mobileTitle(row)}</div>
            )}
            <dl className="grid grid-cols-1 gap-y-2.5">
              {columns.map((c) => (
                <div key={c.key} className="grid grid-cols-[8rem_1fr] gap-3 items-start">
                  <dt className="text-xs text-slate-500 pt-0.5">{c.header}</dt>
                  <dd className="text-sm text-slate-200 break-words min-w-0">{c.render(row)}</dd>
                </div>
              ))}
            </dl>
            {actions && (
              <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
