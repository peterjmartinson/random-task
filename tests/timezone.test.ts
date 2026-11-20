import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ICalAdapter } from '../src/adapters/ical.adapter.js';
import { GoogleCalendarAdapter } from '../src/adapters/google-calendar.js';
import { AppConfigSchema } from '../src/config/config.schema.js';
import { formatOutput } from '../src/pipeline/06-format.js';
import { enrichItems } from '../src/pipeline/04-enrich.js';
import { UnifiedItem } from '../src/models/unified.model.js';
import {
  dateFromYmd,
  formatTimeInTimeZone,
  getDayBoundsInTimeZone,
  parseTargetDateInput,
} from '../src/utils/timezone.js';

vi.mock('axios');

describe('Timezone utilities', () => {
  it('computes exact EST (UTC-5) day bounds for winter dates', () => {
    const bounds = getDayBoundsInTimeZone('2026-11-20', 'America/New_York');
    expect(bounds.startOfDay.toISOString()).toBe('2026-11-20T05:00:00.000Z');
    expect(bounds.nextDayStart.toISOString()).toBe('2026-11-21T05:00:00.000Z');
    expect(bounds.endOfDay.toISOString()).toBe('2026-11-21T04:59:59.999Z');
    expect(bounds.nextDayStart.getTime() - bounds.startOfDay.getTime()).toBe(24 * 3600 * 1000);
  });

  it('computes exact EDT (UTC-4) day bounds for summer dates', () => {
    const bounds = getDayBoundsInTimeZone('2026-07-15', 'America/New_York');
    expect(bounds.startOfDay.toISOString()).toBe('2026-07-15T04:00:00.000Z');
    expect(bounds.nextDayStart.toISOString()).toBe('2026-07-16T04:00:00.000Z');
    expect(bounds.endOfDay.toISOString()).toBe('2026-07-16T03:59:59.999Z');
    expect(bounds.nextDayStart.getTime() - bounds.startOfDay.getTime()).toBe(24 * 3600 * 1000);
  });

  it('handles spring-forward (23h) and fall-back (25h) DST transition days', () => {
    // 2026-03-08: EST (-5) -> EDT (-4)
    const spring = getDayBoundsInTimeZone('2026-03-08', 'America/New_York');
    expect(spring.startOfDay.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(spring.nextDayStart.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(spring.nextDayStart.getTime() - spring.startOfDay.getTime()).toBe(23 * 3600 * 1000);

    // 2026-11-01: EDT (-4) -> EST (-5)
    const fall = getDayBoundsInTimeZone('2026-11-01', 'America/New_York');
    expect(fall.startOfDay.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(fall.nextDayStart.toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(fall.nextDayStart.getTime() - fall.startOfDay.getTime()).toBe(25 * 3600 * 1000);
  });

  it('formats timestamps in the requested IANA timezone regardless of host TZ', () => {
    expect(formatTimeInTimeZone(new Date('2026-11-20T00:00:00.000Z'), 'America/New_York')).toBe('07:00 PM');
    expect(formatTimeInTimeZone(new Date('2026-11-20T00:00:00.000Z'), 'UTC')).toBe('12:00 AM');
    expect(formatTimeInTimeZone(new Date('2026-07-15T13:30:00.000Z'), 'America/New_York')).toBe('09:30 AM');
    expect(formatTimeInTimeZone(new Date('2026-11-20T15:00:00.000Z'), 'America/New_York')).toBe('10:00 AM');
  });

  it('parses YYYY-MM-DD cleanly into noon-UTC anchor Date and rejects invalid calendar dates', () => {
    const valid = parseTargetDateInput('2026-11-20');
    expect(valid?.toISOString()).toBe('2026-11-20T12:00:00.000Z');
    expect(parseTargetDateInput('2026-02-30')).toBeNull();
    expect(parseTargetDateInput('not-a-date')).toBeNull();
  });
});

describe('Timezone-aware calendar filtering & formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('excludes previous evening EST events (6pm-7:30pm and 7pm-8pm) from today and includes tonight 8pm EST', async () => {
    const mockIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:math-1@test.com
SUMMARY:Math Meeting
DTSTART:20261119T230000Z
DTEND:20261120T000000Z
END:VEVENT
BEGIN:VEVENT
UID:math-2@test.com
SUMMARY:Math Meeting Overtime
DTSTART:20261119T230000Z
DTEND:20261120T003000Z
END:VEVENT
BEGIN:VEVENT
UID:lmll@test.com
SUMMARY:LMLL Annual Meeting
DTSTART:20261120T000000Z
DTEND:20261120T010000Z
END:VEVENT
BEGIN:VEVENT
UID:talk-money@test.com
SUMMARY:Talk Money
DTSTART:20261120T150000Z
DTEND:20261120T160000Z
END:VEVENT
BEGIN:VEVENT
UID:dinner@test.com
SUMMARY:Tonight Dinner
DTSTART:20261121T010000Z
DTEND:20261121T023000Z
END:VEVENT
BEGIN:VEVENT
UID:allday-today@test.com
SUMMARY:All Day Today
DTSTART;VALUE=DATE:20261120
DTEND;VALUE=DATE:20261121
END:VEVENT
BEGIN:VEVENT
UID:allday-tomorrow@test.com
SUMMARY:All Day Tomorrow
DTSTART;VALUE=DATE:20261121
DTEND;VALUE=DATE:20261122
END:VEVENT
BEGIN:VEVENT
UID:recur-allday@test.com
SUMMARY:Recurring All Day
RRULE:FREQ=DAILY;COUNT=3
DTSTART;VALUE=DATE:20261119
DTEND;VALUE=DATE:20261120
END:VEVENT
END:VCALENDAR`;

    vi.mocked(axios.get).mockResolvedValue({ data: mockIcs });

    const adapter = new ICalAdapter();
    const config = AppConfigSchema.parse({
      timezone: 'America/New_York',
      calendars: { ical_urls: ['https://calendar.google.com/test.ics'] },
      maps: { enabled: false },
    });

    // Nov 19 EST: should contain Math Meeting (6pm), Math Overtime (6pm-7:30pm), LMLL (7pm), Recurring All Day
    const nov19Items = await adapter.fetchItems(dateFromYmd('2026-11-19'), config);
    const nov19Titles = nov19Items.map((i) => i.title);
    expect(nov19Titles).toContain('Math Meeting');
    expect(nov19Titles).toContain('Math Meeting Overtime');
    expect(nov19Titles).toContain('LMLL Annual Meeting');
    expect(nov19Titles.filter((t) => t === 'Recurring All Day')).toHaveLength(1);
    expect(nov19Titles).not.toContain('Talk Money');
    expect(nov19Titles).not.toContain('Tonight Dinner');
    expect(nov19Titles).not.toContain('All Day Today');

    // Nov 20 EST: should contain Talk Money (10am), Tonight Dinner (8pm), All Day Today, Recurring All Day (1x)
    // and MUST NOT contain yesterday's evening meetings or tomorrow's all-day event
    const nov20Items = await adapter.fetchItems(dateFromYmd('2026-11-20'), config);
    const nov20Titles = nov20Items.map((i) => i.title);
    expect(nov20Titles).toContain('Talk Money');
    expect(nov20Titles).toContain('Tonight Dinner');
    expect(nov20Titles).toContain('All Day Today');
    expect(nov20Titles.filter((t) => t === 'Recurring All Day')).toHaveLength(1);
    expect(nov20Titles).not.toContain('Math Meeting');
    expect(nov20Titles).not.toContain('Math Meeting Overtime');
    expect(nov20Titles).not.toContain('LMLL Annual Meeting');
    expect(nov20Titles).not.toContain('All Day Tomorrow');

    // Verify formatOutput renders Eastern clock times + ISO timestamps + metadata.timezone
    const nov19Output = formatOutput(dateFromYmd('2026-11-19'), nov19Items, [], config.timezone);
    expect(nov19Output.metadata.timezone).toBe('America/New_York');
    const lmll = nov19Output.agenda.find((e) => e.title === 'LMLL Annual Meeting');
    expect(lmll?.time).toBe('07:00 PM - 08:00 PM');
    expect(lmll?.start).toBe('2026-11-20T00:00:00.000Z');
    expect(lmll?.end).toBe('2026-11-20T01:00:00.000Z');

    const nov20Output = formatOutput(dateFromYmd('2026-11-20'), nov20Items, [], config.timezone);
    const dinner = nov20Output.agenda.find((e) => e.title === 'Tonight Dinner');
    expect(dinner?.time).toBe('08:00 PM - 09:30 PM');
    const talkMoney = nov20Output.agenda.find((e) => e.title === 'Talk Money');
    expect(talkMoney?.time).toBe('10:00 AM - 11:00 AM');
  });

  it('queries Google Calendar with Eastern UTC bounds and filters out next-day all-day events', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'ev-today',
            summary: 'Talk Money',
            start: { dateTime: '2026-11-20T10:00:00-05:00' },
            end: { dateTime: '2026-11-20T11:00:00-05:00' },
          },
          {
            id: 'ev-allday-today',
            summary: 'Today Holiday',
            start: { date: '2026-11-20' },
            end: { date: '2026-11-21' },
          },
          {
            id: 'ev-allday-tomorrow',
            summary: 'Tomorrow Holiday',
            start: { date: '2026-11-21' },
            end: { date: '2026-11-22' },
          },
        ],
      },
    });

    const adapter = new GoogleCalendarAdapter();
    const config = AppConfigSchema.parse({
      timezone: 'America/New_York',
      google_calendar: {
        api_key: 'fake-key',
        calendar_ids: ['primary'],
      },
    });

    const items = await adapter.fetchItems(dateFromYmd('2026-11-20'), config);

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/calendars/primary/events'),
      expect.objectContaining({
        params: expect.objectContaining({
          timeMin: '2026-11-20T05:00:00.000Z',
          timeMax: '2026-11-21T05:00:00.000Z',
          timeZone: 'America/New_York',
        }),
      })
    );

    const titles = items.map((i) => i.title);
    expect(titles).toEqual(['Talk Money', 'Today Holiday']);
  });

  it('formats leave_by_time in configured timezone during enrichment', async () => {
    const config = AppConfigSchema.parse({
      timezone: 'America/New_York',
      default_start_location: '123 Home St, Anytown, USA',
      maps: { enabled: true }, // fallback estimate = 15 mins without api_key
    });

    const items: UnifiedItem[] = [
      {
        id: 'ev-1',
        source: 'google_calendar',
        type: 'event',
        title: 'Dentist Appointment',
        timeWindow: {
          start: '2026-11-20T19:30:00.000Z', // 2:30 PM EST
          end: '2026-11-20T20:30:00.000Z',
          allDay: false,
        },
        priority: 'medium',
        status: 'pending',
        metadata: {
          location: '104 Main St, Anytown, USA',
        },
      },
    ];

    const enriched = await enrichItems(items, config);
    // 2:30 PM EST - 15 min fallback drive time = 2:15 PM EST
    expect(enriched[0].metadata.leave_by_time).toBe('02:15 PM');
  });
});
