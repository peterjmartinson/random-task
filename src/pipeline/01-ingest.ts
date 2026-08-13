import { SourceAdapter } from '../adapters/base.adapter.js';
import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem } from '../models/unified.model.js';

export async function ingestSources(
  adapters: SourceAdapter[],
  targetDate: Date,
  config: AppConfig
): Promise<UnifiedItem[]> {
  const results = await Promise.allSettled(
    adapters.map((adapter) => adapter.fetchItems(targetDate, config))
  );

  const allItems: UnifiedItem[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const adapterName = adapters[i].name;

    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    } else {
      console.warn(`Ingestion failed for adapter [${adapterName}]: ${result.reason}`);
    }
  }

  return allItems;
}
