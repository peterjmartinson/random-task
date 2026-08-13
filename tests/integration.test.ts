import { describe, it, expect } from 'vitest';
import { runPipeline } from '../src/pipeline/index.js';
import { AppConfigSchema } from '../src/config/config.schema.js';

describe('End-to-End Pipeline Integration', () => {
  const config = AppConfigSchema.parse({
    max_tasks: 5,
    default_start_location: '123 Home St, Anytown, USA',
    maps: { enabled: true },
  });

  it('should run full mock pipeline and generate valid Screamsheet JSON', async () => {
    const targetDate = new Date('2026-08-13');
    const result = await runPipeline({
      config,
      targetDate,
      mock: true,
    });

    expect(result.date).toBe('2026-08-13');
    expect(result.metadata.generated_at).toBeDefined();
    expect(result.agenda).toBeDefined();
    expect(result.tasks).toBeDefined();

    // Verify deduplication merged duplicate event/task
    const syncEvent = result.agenda.find((e) => e.title === 'Project Sync w/ Sarah');
    expect(syncEvent).toBeDefined();
    expect(syncEvent?.accessory).toContain('Phone: (555) 012-3456');

    // Verify past due accessory tag
    const pastDueTask = result.tasks.find((t) => t.title === 'Draft weekly project budget');
    expect(pastDueTask).toBeDefined();
    expect(pastDueTask?.accessory).toBe('PAST DUE');
  });
});
