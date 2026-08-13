import { UnifiedItem } from '../models/unified.model.js';
import {
  AgendaOutput,
  AgendaEventOutput,
  AgendaTaskOutput,
} from '../models/output.model.js';

export function formatOutput(
  targetDate: Date,
  events: UnifiedItem[],
  tasks: UnifiedItem[]
): AgendaOutput {
  const dateStr = targetDate.toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const agenda: AgendaEventOutput[] = events.map((event) => {
    let timeStr = 'All Day';
    if (event.timeWindow?.start && event.timeWindow?.end && !event.timeWindow.allDay) {
      const startTime = formatTimeString(new Date(event.timeWindow.start));
      const endTime = formatTimeString(new Date(event.timeWindow.end));
      timeStr = `${startTime} - ${endTime}`;
    }

    // Build accessory string
    let accessory: string | undefined = undefined;
    const parts: string[] = [];

    if (event.metadata.location) {
      let locPart = `Address: ${event.metadata.location}`;
      if (event.metadata.drive_time_mins !== undefined) {
        locPart += ` (${event.metadata.drive_time_mins} min drive time`;
        if (event.metadata.leave_by_time) {
          locPart += `. Leave by ${event.metadata.leave_by_time}`;
        }
        locPart += `)`;
      }
      parts.push(locPart);
    } else if (event.metadata.phone) {
      parts.push(`Phone: ${event.metadata.phone}`);
    } else if (event.metadata.email) {
      parts.push(`Email: ${event.metadata.email}`);
    }

    if (parts.length > 0) {
      accessory = parts.join(' | ');
    }

    return {
      id: event.id,
      type: 'event',
      title: event.title,
      time: timeStr,
      url: event.url,
      accessory,
    };
  });

  const formattedTasks: AgendaTaskOutput[] = tasks.map((task) => {
    let accessory: string | undefined = undefined;
    if (task.isPastDue) {
      accessory = 'PAST DUE';
    } else if (task.metadata.phone) {
      accessory = `Phone: ${task.metadata.phone}`;
    }

    return {
      id: task.id,
      title: task.title,
      priority: task.priority,
      url: task.url,
      subtasks: task.subtasks && task.subtasks.length > 0 ? task.subtasks : undefined,
      accessory,
    };
  });

  return {
    date: dateStr,
    metadata: {
      generated_at: nowIso,
      total_events: agenda.length,
      total_tasks: formattedTasks.length,
    },
    agenda,
    tasks: formattedTasks,
  };
}

function formatTimeString(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
  const hoursStr = hours < 10 ? `0${hours}` : hours;
  return `${hoursStr}:${minutesStr} ${ampm}`;
}
