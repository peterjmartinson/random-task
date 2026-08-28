import { z } from 'zod';

export const TrelloLabelDefinitionSchema = z
  .object({
    label_id: z.string().optional(),
    cover_color: z.string().optional(),
    color: z.string().optional(),
    name: z.string().optional(),
    assignee: z.string().optional(),
  })
  .passthrough();

export const TrelloBoardConfigSchema = z.object({
  name: z.string().optional(),
  board_id: z.string(),
  lists: z.array(z.string()).default([]),
  max_tasks: z.number().int().positive().optional(),
  labels: z.record(z.string(), TrelloLabelDefinitionSchema).optional(),
});

export const TrelloConfigSchema = z.object({
  api_key: z.string().optional(),
  token: z.string().optional(),
  boards: z.array(TrelloBoardConfigSchema).default([]),
  include_past_due: z.boolean().default(true),
});

export const ICalEntrySchema = z.union([
  z.string(),
  z.object({
    name: z.string().optional(),
    url: z.string(),
  }),
]);

export const CalendarConfigSchema = z.object({
  ical_urls: z.array(ICalEntrySchema).default([]),
  api_key: z.string().optional(),
  access_token: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  refresh_token: z.string().optional(),
  calendar_ids: z.array(z.string()).default([]),
});

export const MapsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  api_key: z.string().optional(),
});

export const AppConfigSchema = z.object({
  max_tasks: z.number().int().positive().default(5),
  output_directory: z.string().default('./incoming'),
  default_start_location: z.string().default('123 Home St, Anytown, USA'),
  calendars: CalendarConfigSchema.default({}),
  google_calendar: CalendarConfigSchema.default({}),
  trello: TrelloConfigSchema.default({}),
  maps: MapsConfigSchema.default({}),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type TrelloConfig = z.infer<typeof TrelloConfigSchema>;
export type CalendarConfig = z.infer<typeof CalendarConfigSchema>;
export type GoogleCalendarConfig = z.infer<typeof CalendarConfigSchema>;
export type MapsConfig = z.infer<typeof MapsConfigSchema>;
