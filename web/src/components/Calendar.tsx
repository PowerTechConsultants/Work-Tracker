'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  onDateSelect?: (date: Date) => void;
  events?: { date: string; type: 'attendance' | 'leave' | 'task' | 'holiday'; status?: string }[];
}

function getDaysInMonth(date: Date, eventsList: { date: string; type: 'attendance' | 'leave' | 'task' | 'holiday'; status?: string }[]) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const eventsByDate = new Map<string, typeof eventsList>();
  for (const e of eventsList) {
    const existing = eventsByDate.get(e.date);
    if (existing) existing.push(e);
    else eventsByDate.set(e.date, [e]);
  }

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push({ day: null, date: null });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    days.push({ day: i, date: d, events: eventsByDate.get(dateStr) || [] });
  }
  return days;
}

export default function Calendar({ onDateSelect, events = [] }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getEventColor = (type: string, status?: string) => {
    if (type === 'attendance') {
      if (status === 'present') return 'bg-emerald-500';
      if (status === 'absent') return 'bg-rose-500';
      if (status === 'late') return 'bg-amber-500';
      if (status === 'holiday') return 'bg-sky-500';
      return 'bg-slate-500';
    }
    if (type === 'leave') return 'bg-violet-500';
    if (type === 'task') return 'bg-blue-500';
    if (type === 'holiday') return 'bg-sky-500';
    return 'bg-slate-500';
  };

  const days = useMemo(() => getDaysInMonth(currentDate, events), [currentDate, events]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-white">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-slate-400 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d, idx) => (
          <div
            key={d.date ? d.date.toISOString() : `empty-${idx}`}
            onClick={() => d.date && onDateSelect?.(d.date)}
            className={`
              min-h-[80px] p-2 rounded-lg border transition cursor-pointer
              ${d.day 
                ? 'border-slate-700 hover:border-violet-500 hover:bg-slate-800' 
                : 'border-transparent'
              }
            `}
          >
            {d.day && (
              <>
                <div className="text-sm text-white mb-1">{d.day}</div>
                {d.events && d.events.length > 0 && (
                  <div className="space-y-1">
                    {d.events.slice(0, 3).map((e, i) => (
                      <div
                        key={e.date + e.type + (e.status || '') + i}
                        className={`h-1.5 rounded-full ${getEventColor(e.type, e.status)}`}
                        title={`${e.type}${e.status ? ` - ${e.status}` : ''}`}
                      />
                    ))}
                    {d.events.length > 3 && (
                      <div className="text-xs text-slate-500">+{d.events.length - 3}</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
