import { UnifiedItem } from '../models/unified.model.js';

export function parseItems(rawItems: UnifiedItem[]): UnifiedItem[] {
  // Clean, trim titles and descriptions, filter out corrupted items
  return rawItems
    .filter((item) => item && item.id && item.title)
    .map((item) => ({
      ...item,
      title: item.title.trim(),
      description: item.description ? item.description.trim() : undefined,
    }));
}
