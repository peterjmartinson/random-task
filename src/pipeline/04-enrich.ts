import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem } from '../models/unified.model.js';
import { parseContacts } from '../utils/contact-parser.js';
import { calculateDriveTime } from '../utils/maps-client.js';

export async function enrichItems(
  items: UnifiedItem[],
  config: AppConfig
): Promise<UnifiedItem[]> {
  const enriched: UnifiedItem[] = [];

  let currentBaseLocation = config.default_start_location;

  // Separate events (sorted by start time) and tasks
  const events = items
    .filter((i) => i.type === 'event' && i.timeWindow?.start)
    .sort(
      (a, b) =>
        new Date(a.timeWindow!.start).getTime() - new Date(b.timeWindow!.start).getTime()
    );

  const nonEvents = items.filter((i) => i.type !== 'event' || !i.timeWindow?.start);

  for (const event of events) {
    let item = { ...event, metadata: { ...event.metadata } };

    // 1. Check for Base/Start override in title or description
    const textToScan = `${item.title} ${item.description || ''}`;
    const baseMatch = textToScan.match(/(?:Start|Base):\s*([^;\n]+)/i);
    if (baseMatch) {
      currentBaseLocation = baseMatch[1].trim();
    }

    // 2. Extract contacts if missing
    if (!item.metadata.phone || !item.metadata.email) {
      const contacts = parseContacts(`${item.title} ${item.description || ''}`);
      if (contacts.phone && !item.metadata.phone) item.metadata.phone = contacts.phone;
      if (contacts.email && !item.metadata.email) item.metadata.email = contacts.email;
    }

    // 3. Drive Time Calculation for events with location
    const destination = item.metadata.location;
    if (config.maps.enabled && destination) {
      const driveResult = await calculateDriveTime(
        currentBaseLocation,
        destination,
        item.timeWindow?.start,
        config.maps.api_key
      );

      if (driveResult) {
        item.metadata.drive_time_mins = driveResult.durationMinutes;

        // Calculate "Leave by" time
        if (item.timeWindow?.start) {
          const eventStartTime = new Date(item.timeWindow.start);
          const leaveByTime = new Date(
            eventStartTime.getTime() - driveResult.durationMinutes * 60 * 1000
          );

          item.metadata.leave_by_time = formatTimeString(leaveByTime);
        }

        // Update currentBaseLocation for subsequent events
        currentBaseLocation = destination;
      }
    }

    enriched.push(item);
  }

  // Enrich non-event tasks with contacts if present
  for (const task of nonEvents) {
    let item = { ...task, metadata: { ...task.metadata } };
    if (!item.metadata.phone || !item.metadata.email) {
      const contacts = parseContacts(`${item.title} ${item.description || ''}`);
      if (contacts.phone && !item.metadata.phone) item.metadata.phone = contacts.phone;
      if (contacts.email && !item.metadata.email) item.metadata.email = contacts.email;
    }
    enriched.push(item);
  }

  return enriched;
}

function formatTimeString(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour should be 12
  const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
  const hoursStr = hours < 10 ? `0${hours}` : hours;
  return `${hoursStr}:${minutesStr} ${ampm}`;
}
