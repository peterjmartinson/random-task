import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem } from '../models/unified.model.js';

export function prioritizeAndFilterItems(
  items: UnifiedItem[],
  config: AppConfig
): { events: UnifiedItem[]; tasks: UnifiedItem[] } {
  // 1. Separate Events and Tasks
  const events = items.filter((i) => i.type === 'event');
  const tasks = items.filter((i) => i.type === 'task');

  // 2. Sort Events by start time
  events.sort((a, b) => {
    const timeA = a.timeWindow?.start ? new Date(a.timeWindow.start).getTime() : 0;
    const timeB = b.timeWindow?.start ? new Date(b.timeWindow.start).getTime() : 0;
    return timeA - timeB;
  });

  // 3. Sort Tasks by priority (past-due first, then high > medium > low)
  const priorityWeight = { high: 3, medium: 2, low: 1 };

  tasks.sort((a, b) => {
    if (a.isPastDue && !b.isPastDue) return -1;
    if (!a.isPastDue && b.isPastDue) return 1;

    const weightA = priorityWeight[a.priority] || 1;
    const weightB = priorityWeight[b.priority] || 1;
    return weightB - weightA;
  });

  // 4. Cap tasks to max_tasks from config
  const maxTasks = config.max_tasks ?? 5;
  const limitedTasks = tasks.slice(0, maxTasks);

  return {
    events,
    tasks: limitedTasks,
  };
}
