const IST_TIMEZONE = 'Asia/Kolkata';
export function getISTDate() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(new Date());
}
export function getISTYear() {
    return Number(getISTDate().slice(0, 4));
}
// Returns the IST calendar date for a given ISO timestamp/date string.
export function getISTDateFromISO(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime()))
        return '';
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d);
}
// Parses SQLite/MySQL datetime strings ('YYYY-MM-DD HH:mm:ss', UTC) and other
// date/time strings as UTC instead of the server's local timezone.
// Also handles Date objects from MySQL driver.
export function parseUTC(dateString) {
    if (dateString instanceof Date)
        return dateString;
    const s = String(dateString).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        return new Date(s.replace(' ', 'T') + 'Z');
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
        return new Date(s + 'Z');
    }
    return new Date(s);
}
export function getISTNow() {
    // IST wall-clock as a Date, independent of server timezone:
    // shift the instant so that both local getters (getHours) and UTC
    // getters (getUTCHours/toISOString) read IST. The old implementation
    // built `new Date(y,m,d,h,m,s)` in server-local TZ, which broke every
    // UTC-method caller (e.g. attendance yesterday-fallback) on non-IST servers.
    const now = new Date();
    return new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
}
export function isISTPast(hours, minutes) {
    const now = getISTNow();
    return (now.getHours() * 60 + now.getMinutes()) > (hours * 60 + minutes);
}
export function getISTDayOfWeek() {
    return new Date().toLocaleDateString('en-US', { timeZone: IST_TIMEZONE, weekday: 'long' });
}
export function isSundayIST(dateStr) {
    // dateStr is YYYY-MM-DD already in IST — parse as UTC to get correct day-of-week
    const parts = dateStr.split('-').map(Number);
    const y = parts[0] ?? 0;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}
