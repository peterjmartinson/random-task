export type UnifiedItemType = 'event' | 'task' | 'alert' | 'info';
export type PriorityLevel = 'high' | 'medium' | 'low';
export type ItemStatus = 'pending' | 'in_progress' | 'done';

export interface TimeWindow {
  start: string; // ISO 8601 string
  end: string;   // ISO 8601 string
  allDay: boolean;
}

export interface UnifiedItemMetadata {
  location?: string;
  drive_time_mins?: number;
  leave_by_time?: string;
  phone?: string;
  email?: string;
  [key: string]: any;
}

export interface TaskLabel {
  id?: string;
  name?: string;
  color?: string;
}

export interface UnifiedItem {
  id: string;
  source: string; // 'google_calendar', 'trello', 'mock', etc.
  type: UnifiedItemType;
  title: string;
  url?: string;
  timeWindow?: TimeWindow;
  priority: PriorityLevel;
  status: ItemStatus;
  description?: string;
  subtasks?: string[];
  dueDate?: string; // ISO 8601 date string for tasks
  isPastDue?: boolean;
  category?: string; // Section or board category (e.g. 'Homework', 'Home Maintenance')
  assignee?: string; // Identified person or assignee (e.g. 'Isaac', 'Asher')
  labels?: TaskLabel[];
  metadata: UnifiedItemMetadata;
}
