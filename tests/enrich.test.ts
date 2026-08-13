import { describe, it, expect } from 'vitest';
import { enrichItems } from '../src/pipeline/04-enrich.js';
import { AppConfigSchema } from '../src/config/config.schema.js';
import { UnifiedItem } from '../src/models/unified.model.js';

describe('Enrichment Module', () => {
  const config = AppConfigSchema.parse({
    default_start_location: '123 Home St, Anytown, USA',
    maps: { enabled: true },
  });

  it('should extract phone numbers and email addresses', async () => {
    const items: UnifiedItem[] = [
      {
        id: '1',
        source: 'gcal',
        type: 'event',
        title: 'Meeting with Sarah',
        description: 'Call Sarah at (555) 012-3456 or sarah@example.com',
        priority: 'medium',
        status: 'pending',
        metadata: {},
      },
    ];

    const result = await enrichItems(items, config);
    expect(result[0].metadata.phone).toBe('(555) 012-3456');
    expect(result[0].metadata.email).toBe('sarah@example.com');
  });

  it('should calculate drive time and leave by time for locations', async () => {
    const items: UnifiedItem[] = [
      {
        id: '1',
        source: 'gcal',
        type: 'event',
        title: 'Dentist Appointment',
        timeWindow: {
          start: '2026-08-13T14:30:00-04:00',
          end: '2026-08-13T15:30:00-04:00',
          allDay: false,
        },
        priority: 'medium',
        status: 'pending',
        metadata: {
          location: '104 Main St, Anytown, USA',
        },
      },
    ];

    const result = await enrichItems(items, config);
    expect(result[0].metadata.drive_time_mins).toBeGreaterThan(0);
    expect(result[0].metadata.leave_by_time).toBeDefined();
  });
});
