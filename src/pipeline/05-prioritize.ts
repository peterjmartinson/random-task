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

  // 3. Group tasks by category and sort:
  //    (Past-due first -> Earliest due date first -> High priority -> Medium/Low)
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  const sortFn = (a: UnifiedItem, b: UnifiedItem) => {
    // 1. Past due items always come first
    if (a.isPastDue && !b.isPastDue) return -1;
    if (!a.isPastDue && b.isPastDue) return 1;

    // 2. Sort chronologically by due date (earliest due first)
    if (a.dueDate && b.dueDate) {
      const timeA = new Date(a.dueDate).getTime();
      const timeB = new Date(b.dueDate).getTime();
      if (timeA !== timeB) return timeA - timeB;
    } else if (a.dueDate && !b.dueDate) {
      return -1;
    } else if (!a.dueDate && b.dueDate) {
      return 1;
    }

    // 3. Sort by priority
    const weightA = priorityWeight[a.priority] || 1;
    const weightB = priorityWeight[b.priority] || 1;
    return weightB - weightA;
  };

  const categoriesOrder: string[] = [];
  const tasksByCategory = new Map<string, UnifiedItem[]>();

  for (const task of tasks) {
    const cat = task.category || 'Tasks';
    if (!tasksByCategory.has(cat)) {
      tasksByCategory.set(cat, []);
      categoriesOrder.push(cat);
    }
    tasksByCategory.get(cat)!.push(task);
  }

  // 4. Cap tasks per section
  const globalMax = config.max_tasks ?? 10;
  const limitedTasks: UnifiedItem[] = [];

  for (const cat of categoriesOrder) {
    const catTasks = tasksByCategory.get(cat)!;
    catTasks.sort(sortFn);

    const catMax = catTasks[0]?.metadata?.max_tasks ?? globalMax;
    limitedTasks.push(...catTasks.slice(0, catMax));
  }

  return {
    events,
    tasks: limitedTasks,
  };
}
