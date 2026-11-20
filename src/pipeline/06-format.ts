import { UnifiedItem } from '../models/unified.model.js';
import {
  AgendaOutput,
  AgendaEventOutput,
  AgendaTaskOutput,
} from '../models/output.model.js';
import {
  DEFAULT_TIMEZONE,
  extractCalendarDateStr,
  formatTimeInTimeZone,
  resolveTimeZone,
} from '../utils/timezone.js';

export function formatOutput(
  targetDate: Date,
  events: UnifiedItem[],
  tasks: UnifiedItem[],
  timeZone: string = DEFAULT_TIMEZONE
): AgendaOutput {
  const effectiveTimeZone = resolveTimeZone(timeZone);
  const dateStr = extractCalendarDateStr(targetDate);
  const nowIso = new Date().toISOString();

  const agenda: AgendaEventOutput[] = events.map((event) => {
    let timeStr = 'All Day';
    if (event.timeWindow?.start && event.timeWindow?.end && !event.timeWindow.allDay) {
      const startTime = formatTimeInTimeZone(new Date(event.timeWindow.start), effectiveTimeZone);
      const endTime = formatTimeInTimeZone(new Date(event.timeWindow.end), effectiveTimeZone);
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
      start: event.timeWindow?.start,
      end: event.timeWindow?.end,
      allDay: event.timeWindow?.allDay,
      url: event.url,
      accessory,
    };
  });

  const sectionMap = new Map<string, AgendaTaskOutput[]>();
  const sectionOrder: string[] = [];

  for (const task of tasks) {
    const sectionTitle = task.category || 'Tasks';
    if (!sectionMap.has(sectionTitle)) {
      sectionMap.set(sectionTitle, []);
      sectionOrder.push(sectionTitle);
    }

    let accessory: string | undefined = undefined;
    if (task.isPastDue) {
      accessory = 'PAST DUE';
    } else if (task.metadata?.due_label) {
      accessory = String(task.metadata.due_label);
    } else if (task.metadata.phone) {
      accessory = `Phone: ${task.metadata.phone}`;
    }

    sectionMap.get(sectionTitle)!.push({
      id: task.id,
      title: task.title,
      priority: task.priority,
      url: task.url,
      assignee: task.assignee,
      due: task.dueDate,
      labels: task.labels && task.labels.length > 0 ? task.labels : undefined,
      cover_color: task.metadata?.cover_color || undefined,
      subtasks: task.subtasks && task.subtasks.length > 0 ? task.subtasks : undefined,
      accessory,
    });
  }

  const sections = sectionOrder.map((title) => ({
    title,
    tasks: sectionMap.get(title) || [],
  }));

  return {
    date: dateStr,
    metadata: {
      generated_at: nowIso,
      timezone: effectiveTimeZone,
      total_events: agenda.length,
      total_tasks: tasks.length,
    },
    agenda,
    sections,
  };
}
