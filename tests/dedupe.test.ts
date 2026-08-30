import { describe, it, expect } from 'vitest';
import { deduplicateItems } from '../src/pipeline/03-dedupe.js';
import { UnifiedItem } from '../src/models/unified.model.js';

describe('Deduplication Module', () => {
  it('should merge items with similar titles', () => {
    const items: UnifiedItem[] = [
      {
        id: '1',
        source: 'gcal',
        type: 'event',
        title: 'Project Sync w/ Sarah',
        priority: 'medium',
        status: 'pending',
        metadata: {},
      },
      {
        id: '2',
        source: 'trello',
        type: 'task',
        title: 'Project Sync w/ Sarah',
        priority: 'high',
        status: 'pending',
        subtasks: ['Task A', 'Task B'],
        metadata: {},
      },
    ];

    const result = deduplicateItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('event');
    expect(result[0].subtasks).toEqual(['Task A', 'Task B']);
  });

  it('should merge items cross-linked by URL in description', () => {
    const items: UnifiedItem[] = [
      {
        id: '1',
        source: 'gcal',
        type: 'event',
        title: 'Call with client',
        url: 'https://meet.google.com/xyz',
        description: 'See trello card: https://trello.com/c/card123',
        priority: 'medium',
        status: 'pending',
        metadata: {},
      },
      {
        id: '2',
        source: 'trello',
        type: 'task',
        title: 'Discuss roadmap',
        url: 'https://trello.com/c/card123',
        priority: 'high',
        status: 'pending',
        metadata: {},
      },
    ];

    const result = deduplicateItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
    expect(result[0].url).toBe('https://meet.google.com/xyz');
  });

  it('should not deduplicate tasks with identical titles belonging to different assignees', () => {
    const items: UnifiedItem[] = [
      {
        id: 'trello-card-asher',
        source: 'trello',
        type: 'task',
        title: 'Read 15 minutes',
        assignee: 'Asher',
        priority: 'medium',
        status: 'pending',
        category: 'Homework',
        metadata: {},
      },
      {
        id: 'trello-card-isaac',
        source: 'trello',
        type: 'task',
        title: 'Read 15 minutes',
        assignee: 'Isaac',
        priority: 'medium',
        status: 'pending',
        category: 'Homework',
        metadata: {},
      },
    ];

    const result = deduplicateItems(items);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['trello-card-asher', 'trello-card-isaac']);
    expect(result.map((i) => i.assignee)).toEqual(['Asher', 'Isaac']);
    expect(result.map((i) => i.title)).toEqual(['Read 15 minutes', 'Read 15 minutes']);
  });

  it('should not deduplicate distinct task cards with different IDs', () => {
    const items: UnifiedItem[] = [
      {
        id: 'trello-101',
        source: 'trello',
        type: 'task',
        title: 'Take vitamins',
        priority: 'low',
        status: 'pending',
        metadata: {},
      },
      {
        id: 'trello-102',
        source: 'trello',
        type: 'task',
        title: 'Take vitamins',
        priority: 'low',
        status: 'pending',
        metadata: {},
      },
    ];

    const result = deduplicateItems(items);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['trello-101', 'trello-102']);
  });

  it('should not merge event and task if assignees are different', () => {
    const items: UnifiedItem[] = [
      {
        id: 'evt-1',
        source: 'gcal',
        type: 'event',
        title: 'Piano Lesson',
        assignee: 'Asher',
        priority: 'medium',
        status: 'pending',
        metadata: {},
      },
      {
        id: 'tsk-1',
        source: 'trello',
        type: 'task',
        title: 'Piano Lesson',
        assignee: 'Isaac',
        priority: 'medium',
        status: 'pending',
        metadata: {},
      },
    ];

    const result = deduplicateItems(items);
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.assignee === 'Asher')?.type).toBe('event');
    expect(result.find((i) => i.assignee === 'Isaac')?.type).toBe('task');
  });

  it('should merge event and task when assignees match and preserve assignee', () => {
    const items: UnifiedItem[] = [
      {
        id: 'evt-1',
        source: 'gcal',
        type: 'event',
        title: 'Project Review',
        priority: 'medium',
        status: 'pending',
        metadata: {},
      },
      {
        id: 'tsk-1',
        source: 'trello',
        type: 'task',
        title: 'Project Review',
        assignee: 'Isaac',
        priority: 'high',
        status: 'pending',
        subtasks: ['Check slides'],
        metadata: {},
      },
    ];

    const result = deduplicateItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('evt-1');
    expect(result[0].assignee).toBe('Isaac');
    expect(result[0].subtasks).toEqual(['Check slides']);
  });
});
