import { cn } from '@/lib/utils';
import React from 'react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  iconClassName?: string;
  sub?: React.ReactNode;
}

export default function StatCard({ label, value, icon, iconClassName, sub }: StatCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 min-w-0">
      {icon && (
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', iconClassName || 'bg-violet-500/15')}>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 truncate">{label}</p>
        <p className="text-xl font-bold text-white truncate">{value}</p>
        {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}
