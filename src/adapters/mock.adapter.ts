import { SourceAdapter } from './base.adapter.js';
import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem } from '../models/unified.model.js';

export class MockAdapter implements SourceAdapter {
  name = 'mock';

  async fetchItems(targetDate: Date, _config: AppConfig): Promise<UnifiedItem[]> {
    const dateStr = targetDate.toISOString().slice(0, 10);

    return [
      {
        id: 'evt-001',
        source: 'google_calendar',
        type: 'event',
        title: 'Project Sync w/ Sarah',
        url: 'https://meet.google.com/abc-defg-hij',
        timeWindow: {
          start: `${dateStr}T10:00:00-04:00`,
          end: `${dateStr}T10:45:00-04:00`,
          allDay: false,
        },
        priority: 'high',
        status: 'pending',
        description: 'Sync regarding sprint pipeline. Call Sarah at (555) 012-3456.',
        metadata: {
          phone: '(555) 012-3456',
        },
      },
      {
        id: 'evt-002',
        source: 'google_calendar',
        type: 'event',
        title: 'Dentist Appointment',
        url: 'https://calendar.google.com/event?id=dentist-123',
        timeWindow: {
          start: `${dateStr}T14:30:00-04:00`,
          end: `${dateStr}T15:30:00-04:00`,
          allDay: false,
        },
        priority: 'medium',
        status: 'pending',
        description: 'Routine cleaning. Address: 104 Main St',
        metadata: {
          location: '104 Main St, Anytown, USA',
        },
      },
      {
        id: 'tsk-101',
        source: 'trello',
        type: 'task',
        title: 'Review pull requests for core repository',
        url: 'https://trello.com/c/card-uuid-1',
        priority: 'high',
        status: 'pending',
        category: 'Work',
        subtasks: ['Approve PR #45', 'Merge hotfix/auth-leak'],
        metadata: {},
      },
      {
        id: 'tsk-102',
        source: 'trello',
        type: 'task',
        title: 'Draft weekly project budget',
        url: 'https://trello.com/c/card-uuid-2',
        priority: 'medium',
        status: 'pending',
        category: 'Work',
        isPastDue: true,
        dueDate: '2026-08-10T12:00:00-04:00',
        metadata: {},
      },
      {
        id: 'tsk-103',
        source: 'trello',
        type: 'task',
        title: 'Project Sync w/ Sarah', // Intentional duplicate for deduplication test
        url: 'https://trello.com/c/card-uuid-3-sync',
        priority: 'medium',
        status: 'pending',
        category: 'Work',
        subtasks: ['Prepare slide deck', 'Review roadmap'],
        metadata: {},
      },
      {
        id: 'tsk-104',
        source: 'trello',
        type: 'task',
        title: 'Update server SSL certificates',
        url: 'https://trello.com/c/card-uuid-4',
        priority: 'low',
        status: 'pending',
        category: 'Maintenance',
        metadata: {},
      },
    ];
  }
}
