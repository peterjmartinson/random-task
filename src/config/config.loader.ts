import fs from 'node:fs';
import path from 'node:path';
import { AppConfig, AppConfigSchema } from './config.schema.js';

export function loadConfig(configPath?: string): AppConfig {
  const targetPath = configPath || path.resolve(process.cwd(), 'config.json');

  if (!fs.existsSync(targetPath)) {
    // Return validated default configuration if file does not exist
    return AppConfigSchema.parse({});
  }

  try {
    const rawContent = fs.readFileSync(targetPath, 'utf-8');
    const parsedJson = JSON.parse(rawContent);

    // Merge environment variables if missing in config file
    if (!parsedJson.google_calendar?.api_key && process.env.GOOGLE_CALENDAR_API_KEY) {
      parsedJson.google_calendar = {
        ...parsedJson.google_calendar,
        api_key: process.env.GOOGLE_CALENDAR_API_KEY,
      };
    }

    if (!parsedJson.trello?.api_key && process.env.TRELLO_API_KEY) {
      parsedJson.trello = {
        ...parsedJson.trello,
        api_key: process.env.TRELLO_API_KEY,
      };
    }

    if (!parsedJson.trello?.token && process.env.TRELLO_TOKEN) {
      parsedJson.trello = {
        ...parsedJson.trello,
        token: process.env.TRELLO_TOKEN,
      };
    }

    if (!parsedJson.maps?.api_key && process.env.MAPS_API_KEY) {
      parsedJson.maps = {
        ...parsedJson.maps,
        api_key: process.env.MAPS_API_KEY,
      };
    }

    return AppConfigSchema.parse(parsedJson);
  } catch (error) {
    console.warn(`Warning: Failed to parse ${targetPath}, falling back to defaults. Error: ${(error as Error).message}`);
    return AppConfigSchema.parse({});
  }
}
