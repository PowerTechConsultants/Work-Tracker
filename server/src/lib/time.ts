const IST_TIMEZONE = 'Asia/Kolkata';

export function getISTDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export function getISTYear(): number {
  return Number(getISTDate().slice(0, 4));
}

// Returns the IST calendar date for a given ISO timestamp/date string.
export function getISTDateFromISO(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Parses SQLite datetime strings ('YYYY-MM-DD HH:mm:ss', UTC) and other
// date/time strings as UTC instead of the server's local timezone.
export function parseUTC(dateString: string): Date {
  const s = dateString.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(s + 'Z');
  }
  return new Date(s);
}

export function getISTNow(): Date {
  const str = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date());
  const parts = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})/);
  if (!parts) return new Date();
  let h = +parts[4]!;
  if (h === 24) h = 0;
  return new Date(+parts[3]!, +parts[1]! - 1, +parts[2]!, h, +parts[5]!, +parts[6]!);
}

export function isISTPast(hours: number, minutes: number): boolean {
  const now = getISTNow();
  return (now.getHours() * 60 + now.getMinutes()) > (hours * 60 + minutes);
}

export function getISTDayOfWeek(): string {
  return new Date().toLocaleDateString('en-US', { timeZone: IST_TIMEZONE, weekday: 'long' });
}

export function isSundayIST(dateStr: string): boolean {
  // dateStr is YYYY-MM-DD already in IST — parse as UTC to get correct day-of-week
  const parts = dateStr.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}
