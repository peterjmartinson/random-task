import ical, { VEvent } from 'node-ical';
import axios from 'axios';
import { SourceAdapter } from './base.adapter.js';
import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem } from '../models/unified.model.js';
import { parseContacts } from '../utils/contact-parser.js';
import {
  addDaysToYmd,
  extractCalendarDateStr,
  formatProcessLocalYmd,
  getDayBoundsInTimeZone,
  resolveTimeZone,
} from '../utils/timezone.js';

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

    const timeZone = resolveTimeZone(config.timezone);
    const targetDateStr = extractCalendarDateStr(targetDate);
    const { startOfDay, endOfDay } = getDayBoundsInTimeZone(targetDateStr, timeZone);

    // node-ical stores VALUE=DATE all-day events using process-local midnight;
    // build matching process-local day bounds for expanding recurring date-only events.
    const [targetYear, targetMonth, targetDay] = targetDateStr.split('-').map(Number);
    const localDayStart = new Date(targetYear, targetMonth - 1, targetDay, 0, 0, 0, 0);
    const localDayEnd = new Date(targetYear, targetMonth - 1, targetDay, 23, 59, 59, 999);

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

          const isDateOnly =
            event.datetype === 'date' ||
            Boolean((event.start as { dateOnly?: boolean } | undefined)?.dateOnly);

          // Handle recurring events
          if (event.rrule) {
            const expandFrom = isDateOnly ? localDayStart : startOfDay;
            const expandTo = isDateOnly ? localDayEnd : endOfDay;

            try {
              const instances = ical.expandRecurringEvent(event, {
                from: expandFrom,
                to: expandTo,
                includeOverrides: true,
                excludeExdates: true,
              });

              for (const inst of instances) {
                const instAllDay = isDateOnly || inst.isFullDay;
                let windowStart: string;
                let windowEnd: string;

                if (instAllDay) {
                  const startYmd = formatProcessLocalYmd(inst.start);
                  const rawEndYmd = inst.end
                    ? formatProcessLocalYmd(inst.end)
                    : addDaysToYmd(startYmd, 1);
                  const endYmd = rawEndYmd > startYmd ? rawEndYmd : addDaysToYmd(startYmd, 1);
                  if (!(startYmd <= targetDateStr && targetDateStr < endYmd)) {
                    continue;
                  }
                  windowStart = startYmd;
                  windowEnd = endYmd;
                } else {
                  const overlapsDay =
                    (inst.end > startOfDay || inst.start.getTime() === startOfDay.getTime()) &&
                    inst.start <= endOfDay;
                  if (!overlapsDay) {
                    continue;
                  }
                  windowStart = inst.start.toISOString();
                  windowEnd = inst.end.toISOString();
                }

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
                    start: windowStart,
                    end: windowEnd,
                    allDay: instAllDay,
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
              const occurrences = event.rrule.between(expandFrom, expandTo, true);
              const durationMs = event.end && event.start
                ? event.end.getTime() - event.start.getTime()
                : 3600000;

              for (const occDate of occurrences) {
                const occIso = occDate.toISOString().split('T')[0];
                if (event.exdate && Object.keys(event.exdate).some(d => d.startsWith(occIso))) {
                  continue;
                }

                const occStart = new Date(occDate);
                if (event.start && !isDateOnly) {
                  occStart.setHours(
                    event.start.getHours(),
                    event.start.getMinutes(),
                    event.start.getSeconds(),
                    event.start.getMilliseconds()
                  );
                }
                const occEnd = new Date(occStart.getTime() + durationMs);
                const isAllDay = isDateOnly || durationMs >= 86400000;

                let windowStart: string;
                let windowEnd: string;
                if (isDateOnly) {
                  const startYmd = formatProcessLocalYmd(occStart);
                  const rawEndYmd = formatProcessLocalYmd(occEnd);
                  const endYmd = rawEndYmd > startYmd ? rawEndYmd : addDaysToYmd(startYmd, 1);
                  if (!(startYmd <= targetDateStr && targetDateStr < endYmd)) {
                    continue;
                  }
                  windowStart = startYmd;
                  windowEnd = endYmd;
                } else {
                  const overlapsDay =
                    (occEnd > startOfDay || occStart.getTime() === startOfDay.getTime()) &&
                    occStart <= endOfDay;
                  if (!overlapsDay) {
                    continue;
                  }
                  windowStart = occStart.toISOString();
                  windowEnd = occEnd.toISOString();
                }

                const title = extractString(event.summary) || 'Untitled Event';
                const description = extractString(event.description);
                const location = extractString(event.location);
                const contacts = parseContacts(`${description} ${location}`);

                items.push({
                  id: `ical-${event.uid}-${occIso}`,
                  source: this.name,
                  type: 'event',
                  title,
                  url: typeof event.url === 'string' ? event.url : undefined,
                  timeWindow: {
                    start: windowStart,
                    end: windowEnd,
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

            if (isDateOnly) {
              const startYmd = formatProcessLocalYmd(evtStart);
              const rawEndYmd = event.end
                ? formatProcessLocalYmd(evtEnd)
                : addDaysToYmd(startYmd, 1);
              const endYmd = rawEndYmd > startYmd ? rawEndYmd : addDaysToYmd(startYmd, 1);

              if (startYmd <= targetDateStr && targetDateStr < endYmd) {
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
                    start: startYmd,
                    end: endYmd,
                    allDay: true,
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
            } else if (
              (evtEnd > startOfDay || evtStart.getTime() === startOfDay.getTime()) &&
              evtStart <= endOfDay
            ) {
              const isAllDay = (evtEnd.getTime() - evtStart.getTime()) >= 86400000;
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
