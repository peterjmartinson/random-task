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
});
