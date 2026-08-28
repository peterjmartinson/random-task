import ical, { VEvent } from 'node-ical';
import axios from 'axios';
import { SourceAdapter } from './base.adapter.js';
import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem } from '../models/unified.model.js';
import { parseContacts } from '../utils/contact-parser.js';

function extractString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'val' in val) {
    return String((val as { val: unknown }).val || '');
  }
  return String(val);
}

export class ICalAdapter implements SourceAdapter {
  name = 'calendar_ical';

  async fetchItems(targetDate: Date, config: AppConfig): Promise<UnifiedItem[]> {
    const rawEntries = [
      ...(config.calendars?.ical_urls || []),
      ...(config.google_calendar?.ical_urls || []),
    ].filter(Boolean);

    const entries = rawEntries
      .map(entry => {
        if (typeof entry === 'string') {
          return { url: entry, name: undefined };
        }
        return entry;
      })
      .filter(e => Boolean(e?.url));

    if (entries.length === 0) {
      return [];
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const items: UnifiedItem[] = [];

    for (const entry of entries) {
      const url = entry.url;
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'DailyAgendaAggregator/1.0',
          },
        });

        const parsedData = ical.sync.parseICS(response.data);
        const feedCalName = parsedData.vcalendar?.['WR-CALNAME'];
        const calendarLabel = entry.name || (feedCalName ? extractString(feedCalName) : undefined);

        for (const k in parsedData) {
          if (!Object.prototype.hasOwnProperty.call(parsedData, k)) continue;
          const rawComp = parsedData[k];

          if (!rawComp || rawComp.type !== 'VEVENT') continue;
          const event = rawComp as VEvent;

          if (event.status === 'CANCELLED') continue;

          // Handle recurring events
          if (event.rrule) {
            try {
              const instances = ical.expandRecurringEvent(event, {
                from: startOfDay,
                to: endOfDay,
                includeOverrides: true,
                excludeExdates: true,
              });

              for (const inst of instances) {
                const title = extractString(inst.summary) || 'Untitled Event';
                const description = extractString(inst.event?.description);
                const location = extractString(inst.event?.location);
                const contacts = parseContacts(`${description} ${location}`);
                const rawUrl = inst.event?.url;
                const eventUrl = typeof rawUrl === 'string' ? rawUrl : undefined;

                items.push({
                  id: `ical-${event.uid}-${inst.start.toISOString()}`,
                  source: this.name,
                  type: 'event',
                  title,
                  url: eventUrl,
                  timeWindow: {
                    start: inst.start.toISOString(),
                    end: inst.end.toISOString(),
                    allDay: inst.isFullDay,
                  },
                  priority: 'medium',
                  status: 'pending',
                  description: description || undefined,
                  metadata: {
                    calendar: calendarLabel,
                    location: location || undefined,
                    phone: contacts.phone,
                    email: contacts.email,
                  },
                });
              }
            } catch {
              // Fallback to manual recurrence check if expansion fails
              const occurrences = event.rrule.between(startOfDay, endOfDay, true);
              const durationMs = event.end && event.start
                ? event.end.getTime() - event.start.getTime()
                : 3600000;

              for (const occDate of occurrences) {
                const occIso = occDate.toISOString().split('T')[0];
                if (event.exdate && Object.keys(event.exdate).some(d => d.startsWith(occIso))) {
                  continue;
                }

                const occStart = new Date(occDate);
                if (event.start) {
                  occStart.setHours(
                    event.start.getHours(),
                    event.start.getMinutes(),
                    event.start.getSeconds(),
                    event.start.getMilliseconds()
                  );
                }
                const occEnd = new Date(occStart.getTime() + durationMs);
                const title = extractString(event.summary) || 'Untitled Event';
                const description = extractString(event.description);
                const location = extractString(event.location);
                const contacts = parseContacts(`${description} ${location}`);
                const isAllDay = event.datetype === 'date' || durationMs >= 86400000;

                items.push({
                  id: `ical-${event.uid}-${occIso}`,
                  source: this.name,
                  type: 'event',
                  title,
                  url: typeof event.url === 'string' ? event.url : undefined,
                  timeWindow: {
                    start: occStart.toISOString(),
                    end: occEnd.toISOString(),
                    allDay: isAllDay,
                  },
                  priority: 'medium',
                  status: 'pending',
                  description: description || undefined,
                  metadata: {
                    calendar: calendarLabel,
                    location: location || undefined,
                    phone: contacts.phone,
                    email: contacts.email,
                  },
                });
              }
            }
          } else {
            // Single non-recurring event
            if (!event.start) continue;

            const evtStart = new Date(event.start);
            const evtEnd = event.end ? new Date(event.end) : new Date(evtStart.getTime() + 3600000);

            if (evtEnd >= startOfDay && evtStart <= endOfDay) {
              const isAllDay = event.datetype === 'date' || (evtEnd.getTime() - evtStart.getTime()) >= 86400000;
              const title = extractString(event.summary) || 'Untitled Event';
              const description = extractString(event.description);
              const location = extractString(event.location);
              const contacts = parseContacts(`${description} ${location}`);

              items.push({
                id: `ical-${event.uid || Math.random().toString(36).substring(2)}`,
                source: this.name,
                type: 'event',
                title,
                url: typeof event.url === 'string' ? event.url : undefined,
                timeWindow: {
                  start: evtStart.toISOString(),
                  end: evtEnd.toISOString(),
                  allDay: isAllDay,
                },
                priority: 'medium',
                status: 'pending',
                description: description || undefined,
                metadata: {
                  calendar: calendarLabel,
                  location: location || undefined,
                  phone: contacts.phone,
                  email: contacts.email,
                },
              });
            }
          }
        }
      } catch (err: any) {
        console.warn(`Failed to fetch iCal feed [${url.substring(0, 40)}...]: ${err.message}`);
      }
    }

    return items;
  }
}
