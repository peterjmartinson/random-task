export const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Validate whether a string is a recognized IANA timezone identifier.
 */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the effective IANA timezone, falling back to DEFAULT_TIMEZONE.
 */
export function resolveTimeZone(timeZone?: string): string {
  if (timeZone && isValidTimeZone(timeZone)) {
    return timeZone;
  }
  return DEFAULT_TIMEZONE;
}

/**
 * Format an arbitrary Date into a YYYY-MM-DD string in the given IANA timezone.
 */
export function getDateStringInTimeZone(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    else if (p.type === 'month') month = p.value;
    else if (p.type === 'day') day = p.value;
  }
  return `${year}-${month}-${day}`;
}

/**
 * Extract the calendar date YYYY-MM-DD from a targetDate Date object.
 * targetDate is normalized around UTC noon (YYYY-MM-DDT12:00:00.000Z) or UTC midnight
 * (from `new Date('YYYY-MM-DD')`), so slicing the UTC ISO date is stable across all runtimes.
 */
export function extractCalendarDateStr(targetDate: Date): string {
  return targetDate.toISOString().slice(0, 10);
}

/**
 * Build a noon-UTC anchor Date for a YYYY-MM-DD calendar date string.
 * Noon UTC keeps the calendar date identical across virtually all timezones (UTC-11..UTC+11).
 */
export function dateFromYmd(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00.000Z`);
}

/**
 * Parse a user-supplied date query/CLI string into a noon-UTC anchor Date.
 * Accepts "YYYY-MM-DD" or any valid ISO date string; returns null if invalid.
 */
export function parseTargetDateInput(raw: string): Date | null {
  const trimmed = raw.trim();
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, yStr, mStr, dStr] = ymdMatch;
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const check = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
    if (
      check.getUTCFullYear() !== y ||
      check.getUTCMonth() + 1 !== m ||
      check.getUTCDate() !== d
    ) {
      return null;
    }
    return check;
  }
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

/**
 * Add `days` calendar days to a YYYY-MM-DD string using pure calendar arithmetic.
 */
export function addDaysToYmd(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0, 0));
  return next.toISOString().slice(0, 10);
}

/**
 * Format a Date's process-local calendar date as YYYY-MM-DD.
 * Used specifically for node-ical VALUE=DATE objects, which store date-only
 * values in the process-local year/month/day fields.
 */
export function formatProcessLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Compute the offset in milliseconds such that:
 *   localWallTimeAsUtcMs = utcMs + offsetMs
 * For example, America/New_York in EST (UTC-5) returns -5 * 3600 * 1000.
 */
function getTimeZoneOffsetMs(utcDate: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(utcDate);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = Number(p.value);
    }
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second
  );
  const utcTrunc = Math.floor(utcDate.getTime() / 1000) * 1000;
  return asUtc - utcTrunc;
}

/**
 * Compute the exact UTC Date instant for 00:00:00.000 on `dateStr` (YYYY-MM-DD) in `timeZone`.
 */
export function getStartOfDayInTimeZone(dateStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcGuessMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const offset1 = getTimeZoneOffsetMs(new Date(utcGuessMs), timeZone);
  const candidate1Ms = utcGuessMs - offset1;
  const offset2 = getTimeZoneOffsetMs(new Date(candidate1Ms), timeZone);
  return new Date(utcGuessMs - offset2);
}

export interface DayBounds {
  dateStr: string;
  startOfDay: Date;
  endOfDay: Date;
  nextDayStart: Date;
}

/**
 * Compute exact UTC boundaries for calendar day `dateStr` (YYYY-MM-DD) in `timeZone`.
 * Automatically accounts for DST transitions (23-hour spring-forward and 25-hour fall-back days).
 */
export function getDayBoundsInTimeZone(dateStr: string, timeZone: string): DayBounds {
  const startOfDay = getStartOfDayInTimeZone(dateStr, timeZone);
  const nextDateStr = addDaysToYmd(dateStr, 1);
  const nextDayStart = getStartOfDayInTimeZone(nextDateStr, timeZone);
  const endOfDay = new Date(nextDayStart.getTime() - 1);
  return {
    dateStr,
    startOfDay,
    endOfDay,
    nextDayStart,
  };
}

/**
 * Format a Date as a 12-hour clock string (e.g. "09:30 AM", "07:00 PM") in `timeZone`.
 */
export function formatTimeInTimeZone(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const parts = dtf.formatToParts(date);
  let hour = '12';
  let minute = '00';
  let dayPeriod = 'AM';
  for (const p of parts) {
    if (p.type === 'hour') hour = p.value.padStart(2, '0');
    else if (p.type === 'minute') minute = p.value.padStart(2, '0');
    else if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
  }
  return `${hour}:${minute} ${dayPeriod}`;
}
