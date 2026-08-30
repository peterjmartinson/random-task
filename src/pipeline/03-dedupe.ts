import levenshtein from 'fast-levenshtein';
import { UnifiedItem } from '../models/unified.model.js';

export function deduplicateItems(items: UnifiedItem[]): UnifiedItem[] {
  const result: UnifiedItem[] = [];
  const mergedIds = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const itemA = items[i];
    if (mergedIds.has(itemA.id)) continue;

    let mergedItem = { ...itemA };

    for (let j = i + 1; j < items.length; j++) {
      const itemB = items[j];
      if (mergedIds.has(itemB.id)) continue;

      if (isDuplicate(mergedItem, itemB)) {
        mergedItem = mergeItems(mergedItem, itemB);
        mergedIds.add(itemB.id);
      }
    }

    result.push(mergedItem);
  }

  return result;
}

function isDuplicate(a: UnifiedItem, b: UnifiedItem): boolean {
  // Rule 0: Different assignees belong to different people and are never duplicates
  if (a.assignee && b.assignee && a.assignee !== b.assignee) {
    return false;
  }

  // Rule 1: If both items are tasks, differentiate by unique ID and composite key (title, assignee)
  if (a.type === 'task' && b.type === 'task') {
    if (a.assignee !== b.assignee) {
      return false;
    }
    // Check cross-linked URL matching for tasks
    if (a.url && b.description && b.description.includes(a.url)) return true;
    if (b.url && a.description && a.description.includes(b.url)) return true;

    // Distinct task cards with different IDs must not be merged
    return a.id === b.id;
  }

  // Rule 2: Cross-linked URL matching (e.g. between event and task or between events)
  if (a.url && b.description && b.description.includes(a.url)) return true;
  if (b.url && a.description && a.description.includes(b.url)) return true;

  // Rule 3: Fuzzy title matching (e.g. merging calendar event and matching task or duplicate events)
  const titleA = a.title.toLowerCase().trim();
  const titleB = b.title.toLowerCase().trim();

  if (titleA === titleB) return true;

  const distance = levenshtein.get(titleA, titleB);
  const maxLength = Math.max(titleA.length, titleB.length);
  if (maxLength === 0) return true;

  const similarity = 1 - distance / maxLength;
  return similarity >= 0.75;
}

function mergeItems(a: UnifiedItem, b: UnifiedItem): UnifiedItem {
  // Prefer 'event' over 'task' type
  const isEvent = a.type === 'event' || b.type === 'event';
  const eventItem = a.type === 'event' ? a : b.type === 'event' ? b : a;
  const taskItem = a.type === 'task' ? a : b.type === 'task' ? b : b;

  const mergedSubtasks = Array.from(
    new Set([...(a.subtasks || []), ...(b.subtasks || [])])
  );

  return {
    ...eventItem,
    type: isEvent ? 'event' : eventItem.type,
    url: eventItem.url || taskItem.url,
    assignee: eventItem.assignee || taskItem.assignee,
    category: eventItem.category || taskItem.category,
    subtasks: mergedSubtasks.length > 0 ? mergedSubtasks : undefined,
    metadata: {
      ...taskItem.metadata,
      ...eventItem.metadata,
    },
  };
}
