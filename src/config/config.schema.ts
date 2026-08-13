import { z } from 'zod';

export const TrelloBoardConfigSchema = z.object({
  board_id: z.string(),
  lists: z.array(z.string()).default([]),
});

export const TrelloConfigSchema = z.object({
  api_key: z.string().optional(),
  token: z.string().optional(),
  boards: z.array(TrelloBoardConfigSchema).default([]),
  include_past_due: z.boolean().default(true),
});

export const GoogleCalendarConfigSchema = z.object({
  api_key: z.string().optional(),
  access_token: z.string().optional(),
  calendar_ids: z.array(z.string()).default(['primary']),
});

export const MapsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  api_key: z.string().optional(),
});

export const AppConfigSchema = z.object({
  max_tasks: z.number().int().positive().default(5),
  output_directory: z.string().default('./incoming'),
  default_start_location: z.string().default('123 Home St, Anytown, USA'),
  google_calendar: GoogleCalendarConfigSchema.default({}),
  trello: TrelloConfigSchema.default({}),
  maps: MapsConfigSchema.default({}),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type TrelloConfig = z.infer<typeof TrelloConfigSchema>;
export type GoogleCalendarConfig = z.infer<typeof GoogleCalendarConfigSchema>;
export type MapsConfig = z.infer<typeof MapsConfigSchema>;
