import axios from 'axios';
import { SourceAdapter } from './base.adapter.js';
import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem } from '../models/unified.model.js';
import { parseContacts } from '../utils/contact-parser.js';

export class GoogleCalendarAdapter implements SourceAdapter {
  name = 'google_calendar';

  async fetchItems(targetDate: Date, config: AppConfig): Promise<UnifiedItem[]> {
    const gcalConfig = config.google_calendar;
    if (!gcalConfig?.calendar_ids || gcalConfig.calendar_ids.length === 0) {
      return [];
    }

    const apiKey = gcalConfig.api_key;
    const accessToken = gcalConfig.access_token;

    if (!apiKey && !accessToken) {
      console.warn('Google Calendar adapter skipped: Neither api_key nor access_token provided.');
      return [];
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const items: UnifiedItem[] = [];

    for (const calendarId of gcalConfig.calendar_ids) {
      try {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events`;

        const headers: Record<string, string> = {};
        const params: Record<string, any> = {
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        };

        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        } else if (apiKey) {
          params['key'] = apiKey;
        }

        const response = await axios.get(url, { headers, params, timeout: 8000 });
        const events = response.data?.items ?? [];

        for (const evt of events) {
          if (evt.status === 'cancelled') continue;

          const startStr = evt.start?.dateTime || evt.start?.date;
          const endStr = evt.end?.dateTime || evt.end?.date;
          const isAllDay = !evt.start?.dateTime;

          const contacts = parseContacts(`${evt.description || ''} ${evt.location || ''}`);

          items.push({
            id: `gcal-${evt.id}`,
            source: this.name,
            type: 'event',
            title: evt.summary || 'Untitled Event',
            url: evt.htmlLink || evt.hangoutLink,
            timeWindow: {
              start: startStr,
              end: endStr,
              allDay: isAllDay,
            },
            priority: 'medium',
            status: 'pending',
            description: evt.description,
            metadata: {
              location: evt.location,
              phone: contacts.phone,
              email: contacts.email,
              attendeesCount: evt.attendees?.length || 0,
            },
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch Google Calendar [${calendarId}]: ${(error as Error).message}`);
      }
    }

    return items;
  }
}
