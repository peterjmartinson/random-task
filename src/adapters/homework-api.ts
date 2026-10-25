import axios from 'axios';
import { SourceAdapter } from './base.adapter.js';
import { AppConfig } from '../config/config.schema.js';
import { UnifiedItem, PriorityLevel } from '../models/unified.model.js';

export interface HomeworkApiTask {
  id: string;
  kid: string;
  class?: string;
  type?: 'weekly' | 'upcoming' | string;
  title: string;
  raw_title?: string;
  due?: string;
  due_label?: string;
  priority?: PriorityLevel;
  cover_color?: string;
  notes?: string;
}

export interface HomeworkApiResponse {
  date: string;
  next_school_day?: string;
  tasks: HomeworkApiTask[];
}

export const DEFAULT_HOMEWORK_API_URL = 'https://assignment-tracker-umber.vercel.app/api/homework';

export class HomeworkApiAdapter implements SourceAdapter {
  name = 'homework_api';

  async fetchItems(targetDate: Date, config: AppConfig): Promise<UnifiedItem[]> {
    const hwConfig = config.homework;
    const apiUrl = (
      hwConfig?.api_url ||
      process.env.HOMEWORK_API_URL ||
      DEFAULT_HOMEWORK_API_URL
    ).trim();

    if (hwConfig?.enabled === false || !apiUrl) {
      return [];
    }

    const targetDateStr = targetDate.toISOString().slice(0, 10);
    const maxTasks = hwConfig?.max_tasks ?? 15;
    const groupByKid = hwConfig?.group_by_kid !== false;

    try {
      const response = await axios.get<HomeworkApiResponse>(apiUrl, {
        params: { date: targetDateStr },
        timeout: 10000,
      });

      const tasks = Array.isArray(response.data?.tasks) ? response.data.tasks : [];

      return tasks.map((t, idx) => {
        const kid = (t.kid || '').trim() || undefined;
        const subject = (t.class || '').trim() || undefined;
        const cleanTitle = (t.raw_title || t.title || '').trim();
        const category = groupByKid && kid ? kid : 'Homework';
        const priority: PriorityLevel =
          t.priority === 'high' || t.priority === 'medium' || t.priority === 'low'
            ? t.priority
            : 'medium';

        return {
          id: t.id || `hw-${idx}`,
          source: this.name,
          type: 'task',
          title: cleanTitle,
          priority,
          status: 'pending',
          description: t.notes || '',
          subtasks: [],
          dueDate: t.due || targetDateStr,
          isPastDue: false,
          category,
          assignee: kid,
          labels: subject
            ? [
                {
                  name: subject,
                  color: t.cover_color,
                },
              ]
            : undefined,
          metadata: {
            board_name: 'Homework',
            cover_color: t.cover_color,
            due_label: t.due_label,
            homework_type: t.type,
            max_tasks: maxTasks,
          },
        };
      });
    } catch (error) {
      console.warn(`Failed to fetch homework from API [${apiUrl}]: ${(error as Error).message}`);
      return [];
    }
  }
}
