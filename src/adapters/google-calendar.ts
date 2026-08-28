import axios from 'axios';
import { SourceAdapter } from './base.adapter.js';
import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem } from '../models/unified.model.js';
import { parseContacts } from '../utils/contact-parser.js';

async function resolveAccessToken(gcalConfig: AppConfig['google_calendar']): Promise<string | undefined> {
  if (gcalConfig?.access_token) {
    return gcalConfig.access_token;
  }
  if (gcalConfig?.refresh_token && gcalConfig.client_id && gcalConfig.client_secret) {
    try {
      const resp = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: gcalConfig.client_id,
        client_secret: gcalConfig.client_secret,
        refresh_token: gcalConfig.refresh_token,
        grant_type: 'refresh_token',
      });
      return resp.data?.access_token;
    } catch (err: any) {
      console.warn(`Failed to refresh Google OAuth token: ${err?.response?.data?.error_description || err.message}`);
    }
  }
  return undefined;
}

export class GoogleCalendarAdapter implements SourceAdapter {
  name = 'google_calendar';

  async fetchItems(targetDate: Date, config: AppConfig): Promise<UnifiedItem[]> {
    const gcalConfig = config.google_calendar;
    if (!gcalConfig?.calendar_ids || gcalConfig.calendar_ids.length === 0) {
      return [];
    }

    const apiKey = gcalConfig.api_key;
    const accessToken = await resolveAccessToken(gcalConfig);

    if (!apiKey && !accessToken) {
      console.warn('Google Calendar adapter skipped: Neither api_key nor valid OAuth access_token/refresh_token provided.');
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
