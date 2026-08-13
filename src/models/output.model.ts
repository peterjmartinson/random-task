export interface AgendaEventOutput {
  id: string;
  type: 'event';
  title: string;
  time: string; // e.g. "10:00 AM - 10:45 AM"
  url?: string;
  accessory?: string; // e.g. "Address: 104 Main St (15 min drive time. Leave by 02:15 PM)" or "Phone: (555) 012-3456"
}

export interface AgendaTaskOutput {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  url?: string;
  subtasks?: string[];
  accessory?: string; // e.g. "PAST DUE"
}

export interface AgendaOutputMetadata {
  generated_at: string;
  total_events?: number;
  total_tasks?: number;
}

export interface AgendaOutput {
  date: string; // YYYY-MM-DD
  metadata: AgendaOutputMetadata;
  agenda: AgendaEventOutput[];
  tasks: AgendaTaskOutput[];
}
