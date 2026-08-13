import axios from 'axios';
import { SourceAdapter } from './base.adapter.js';
import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem, PriorityLevel } from '../models/unified.model.js';
import { parseContacts } from '../utils/contact-parser.js';

export class TrelloAdapter implements SourceAdapter {
  name = 'trello';

  async fetchItems(targetDate: Date, config: AppConfig): Promise<UnifiedItem[]> {
    const trelloConfig = config.trello;
    if (!trelloConfig?.api_key || !trelloConfig?.token) {
      console.warn('Trello adapter skipped: API Key or Token missing.');
      return [];
    }

    const { api_key, token, boards, include_past_due } = trelloConfig;
    if (!boards || boards.length === 0) return [];

    const items: UnifiedItem[] = [];
    const targetDateStr = targetDate.toISOString().slice(0, 10);
    const startOfToday = new Date(targetDate);
    startOfToday.setHours(0, 0, 0, 0);

    for (const board of boards) {
      const { board_id, lists } = board;

      // 1. Fetch cards for specified lists
      for (const listId of lists) {
        try {
          const cardsUrl = `https://api.trello.com/1/lists/${listId}/cards`;
          const response = await axios.get(cardsUrl, {
            params: {
              key: api_key,
              token: token,
              checklists: 'all',
            },
            timeout: 8000,
          });

          const cards = response.data ?? [];
          for (const card of cards) {
            if (card.closed) continue;

            const cardDueDate = card.due ? new Date(card.due) : null;
            let isPastDue = false;

            if (cardDueDate && cardDueDate < startOfToday && !card.dueComplete) {
              isPastDue = true;
            }

            // Subtasks from checklists
            const subtasks: string[] = [];
            if (card.checklists) {
              for (const checklist of card.checklists) {
                if (checklist.checkItems) {
                  for (const checkItem of checklist.checkItems) {
                    if (checkItem.state === 'incomplete') {
                      subtasks.push(checkItem.name);
                    }
                  }
                }
              }
            }

            // Infer priority from labels or past due status
            let priority: PriorityLevel = 'medium';
            if (card.labels) {
              const labelNames = card.labels.map((l: any) => (l.name || '').toLowerCase());
              if (labelNames.includes('high') || labelNames.includes('urgent') || isPastDue) {
                priority = 'high';
              } else if (labelNames.includes('low')) {
                priority = 'low';
              }
            }

            const contacts = parseContacts(card.desc);

            items.push({
              id: `trello-${card.id}`,
              source: this.name,
              type: 'task',
              title: card.name,
              url: card.shortUrl || card.url,
              priority,
              status: card.dueComplete ? 'done' : 'pending',
              description: card.desc,
              subtasks,
              dueDate: card.due || undefined,
              isPastDue,
              metadata: {
                board_id,
                list_id: listId,
                phone: contacts.phone,
                email: contacts.email,
              },
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch Trello list [${listId}]: ${(error as Error).message}`);
        }
      }

      // 2. Fetch past due cards across the board if include_past_due is true
      if (include_past_due) {
        try {
          const boardCardsUrl = `https://api.trello.com/1/boards/${board_id}/cards`;
          const response = await axios.get(boardCardsUrl, {
            params: {
              key: api_key,
              token: token,
              filter: 'open',
            },
            timeout: 8000,
          });

          const allCards = response.data ?? [];
          for (const card of allCards) {
            if (card.closed || card.dueComplete || !card.due) continue;

            const cardDueDate = new Date(card.due);
            if (cardDueDate < startOfToday) {
              // Avoid duplicates if already added from specific list
              if (items.some((i) => i.id === `trello-${card.id}`)) continue;

              const contacts = parseContacts(card.desc);
              items.push({
                id: `trello-${card.id}`,
                source: this.name,
                type: 'task',
                title: card.name,
                url: card.shortUrl || card.url,
                priority: 'high',
                status: 'pending',
                description: card.desc,
                subtasks: [],
                dueDate: card.due,
                isPastDue: true,
                metadata: {
                  board_id,
                  phone: contacts.phone,
                  email: contacts.email,
                },
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch past-due cards for board [${board_id}]: ${(error as Error).message}`);
        }
      }
    }

    return items;
  }
}
