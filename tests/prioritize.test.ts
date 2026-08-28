import { describe, it, expect } from 'vitest';
import { prioritizeAndFilterItems } from '../src/pipeline/05-prioritize.js';
import { AppConfigSchema } from '../src/config/config.schema.js';
import { UnifiedItem } from '../src/models/unified.model.js';

describe('Prioritization Module', () => {
  const config = AppConfigSchema.parse({
    max_tasks: 2,
  });

  it('should place past-due tasks first and cap tasks to max_tasks', () => {
    const items: UnifiedItem[] = [
      {
        id: '1',
        source: 'trello',
        type: 'task',
        title: 'Task Low Priority',
        priority: 'low',
        status: 'pending',
        metadata: {},
      },
      {
        id: '2',
        source: 'trello',
        type: 'task',
        title: 'Task Past Due',
        priority: 'medium',
        status: 'pending',
        isPastDue: true,
        metadata: {},
      },
      {
        id: '3',
        source: 'trello',
        type: 'task',
        title: 'Task High Priority',
        priority: 'high',
        status: 'pending',
        metadata: {},
      },
    ];

    const { tasks } = prioritizeAndFilterItems(items, config);
    expect(tasks).toHaveLength(2); // Capped to max_tasks = 2
    expect(tasks[0].id).toBe('2'); // Past due task first
    expect(tasks[1].id).toBe('3'); // High priority task second
  });

  it('should group and cap tasks per category independently', () => {
    const items: UnifiedItem[] = [
      { id: '1', source: 'trello', type: 'task', title: 'HW 1', priority: 'low', status: 'pending', category: 'Homework', metadata: {} },
      { id: '2', source: 'trello', type: 'task', title: 'HW 2', priority: 'high', status: 'pending', category: 'Homework', metadata: {} },
      { id: '3', source: 'trello', type: 'task', title: 'HW 3', priority: 'medium', status: 'pending', category: 'Homework', metadata: {} },
      { id: '4', source: 'trello', type: 'task', title: 'Maint 1', priority: 'low', status: 'pending', category: 'Home Maintenance', metadata: {} },
      { id: '5', source: 'trello', type: 'task', title: 'Maint 2', priority: 'high', status: 'pending', category: 'Home Maintenance', metadata: {} },
    ];

    const { tasks } = prioritizeAndFilterItems(items, config);
    // 2 for Homework + 2 for Home Maintenance = 4 total
    expect(tasks).toHaveLength(4);

    const hwTasks = tasks.filter(t => t.category === 'Homework');
    expect(hwTasks).toHaveLength(2);
    expect(hwTasks[0].id).toBe('2'); // High priority first

    const maintTasks = tasks.filter(t => t.category === 'Home Maintenance');
    expect(maintTasks).toHaveLength(2);
    expect(maintTasks[0].id).toBe('5'); // High priority first
  });
});
