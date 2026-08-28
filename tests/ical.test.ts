import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { ICalAdapter } from '../src/adapters/ical.adapter.js';
import { AppConfig } from '../src/config/config.schema.js';

vi.mock('axios');

describe('ICalAdapter', () => {
  it('should parse single and recurring iCal events on the target date', async () => {
    const mockIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:event-1@test.com
SUMMARY:Single Meeting
DTSTART:20260825T140000Z
DTEND:20260825T150000Z
DESCRIPTION:Discuss project Call (555) 123-4567
LOCATION:123 Main St
END:VEVENT
BEGIN:VEVENT
UID:event-2@test.com
SUMMARY:Daily Standup
RRULE:FREQ=DAILY;COUNT=10
DTSTART:20260820T130000Z
DTEND:20260820T133000Z
DESCRIPTION:Daily recurring meeting
END:VEVENT
END:VCALENDAR`;

    vi.mocked(axios.get).mockResolvedValueOnce({ data: mockIcs });

    const adapter = new ICalAdapter();
    const config: AppConfig = {
      max_tasks: 5,
      output_directory: './output',
      default_start_location: 'Home',
      calendars: {
        ical_urls: ['https://calendar.google.com/test.ics'],
        calendar_ids: [],
      },
      google_calendar: {
        ical_urls: [],
        calendar_ids: [],
      },
      trello: { boards: [], include_past_due: true },
      maps: { enabled: false },
    };

    const targetDate = new Date('2026-08-25T12:00:00Z');
    const items = await adapter.fetchItems(targetDate, config);

    expect(items.length).toBeGreaterThanOrEqual(2);
    
    const singleEvent = items.find(i => i.title === 'Single Meeting');
    expect(singleEvent).toBeDefined();
    expect(singleEvent?.metadata?.phone).toBe('(555) 123-4567');
    expect(singleEvent?.metadata?.location).toBe('123 Main St');

    const recurringEvent = items.find(i => i.title === 'Daily Standup');
    expect(recurringEvent).toBeDefined();
  });
});
