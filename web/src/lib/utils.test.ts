import { describe, expect, it } from 'vitest';
import {
  DAY_HOURS,
  dayTypeLabel,
  formatHoursAsDuration,
  formatOvertimeHours,
  formatWorkedDuration,
} from './utils';

describe('dayTypeLabel', () => {
  it('labels work_end as Full Day', () => {
    expect(dayTypeLabel('work_end', 6)).toBe('Full Day');
    expect(dayTypeLabel('work_end', 8)).toBe('Full Day');
  });

  it('labels half_day as Half Day', () => {
    expect(dayTypeLabel('half_day', 3)).toBe('Half Day');
  });

  it('labels present/on_break/absent/leave/holiday/remote', () => {
    expect(dayTypeLabel('present')).toBe('Present');
    expect(dayTypeLabel('on_break')).toBe('On Break');
    expect(dayTypeLabel('absent')).toBe('Absent');
    expect(dayTypeLabel('leave')).toBe('Leave');
    expect(dayTypeLabel('holiday')).toBe('Holiday');
    expect(dayTypeLabel('remote')).toBe('Remote');
  });

  it('falls back to a prettified status for unknown statuses', () => {
    expect(dayTypeLabel('on_leave')).toBe('On Leave');
  });

  it('returns an em dash for empty status', () => {
    expect(dayTypeLabel('')).toBe('—');
  });
});

describe('formatOvertimeHours', () => {
  it('returns - for null, undefined, and non-positive values', () => {
    expect(formatOvertimeHours(null)).toBe('-');
    expect(formatOvertimeHours(undefined)).toBe('-');
    expect(formatOvertimeHours(0)).toBe('-');
    expect(formatOvertimeHours(-2)).toBe('-');
  });

  it('formats hours below a full day with h and m', () => {
    expect(formatOvertimeHours(1.5)).toBe('+1h 30m');
  });

  it('treats 8 cumulative hours as 1 day', () => {
    expect(formatOvertimeHours(8)).toBe('+1d 0h');
  });

  it('formats mixed days, hours, minutes', () => {
    expect(formatOvertimeHours(9.5)).toBe('+1d 1h 30m');
  });

  it('formats a handful of minutes alone', () => {
    expect(formatOvertimeHours(0.5)).toBe('+30m');
  });
});

describe('formatHoursAsDuration', () => {
  it('formats plain hours', () => {
    expect(formatHoursAsDuration(6)).toBe('6h 0m');
  });

  it('formats hours with minutes', () => {
    expect(formatHoursAsDuration(6.5)).toBe('6h 30m');
  });

  it('formats beyond a day', () => {
    expect(formatHoursAsDuration(DAY_HOURS + 2)).toBe('1d 2h 0m');
  });

  it('preserves a negative sign', () => {
    expect(formatHoursAsDuration(-3)).toBe('-3h 0m');
  });
});

describe('formatWorkedDuration', () => {
  it('returns 0h 0m for null, undefined, and non-positive', () => {
    expect(formatWorkedDuration(null)).toBe('0h 0m');
    expect(formatWorkedDuration(undefined)).toBe('0h 0m');
    expect(formatWorkedDuration(0)).toBe('0h 0m');
    expect(formatWorkedDuration(-1)).toBe('0h 0m');
  });

  it('formats hours and minutes', () => {
    expect(formatWorkedDuration(6.5)).toBe('6h 30m');
  });

  it('formats whole hours', () => {
    expect(formatWorkedDuration(8)).toBe('8h 0m');
  });
});
