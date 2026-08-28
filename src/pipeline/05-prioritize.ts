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

  // 3. Group tasks by category and sort (past-due first, then high > medium > low)
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  const sortFn = (a: UnifiedItem, b: UnifiedItem) => {
    if (a.isPastDue && !b.isPastDue) return -1;
    if (!a.isPastDue && b.isPastDue) return 1;

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
  const globalMax = config.max_tasks ?? 5;
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
