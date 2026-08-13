import { AppConfig } from '../config/config.schema.js';
import { SourceAdapter } from '../adapters/base.adapter.js';
import { GoogleCalendarAdapter } from '../adapters/google-calendar.js';
import { TrelloAdapter } from '../adapters/trello.js';
import { MockAdapter } from '../adapters/mock.adapter.js';
import { ingestSources } from './01-ingest.js';
import { parseItems } from './02-parse.js';
import { deduplicateItems } from './03-dedupe.js';
import { enrichItems } from './04-enrich.js';
import { prioritizeAndFilterItems } from './05-prioritize.js';
import { formatOutput } from './06-format.js';
import { AgendaOutput } from '../models/output.model.js';

export interface RunPipelineOptions {
  config: AppConfig;
  targetDate?: Date;
  mock?: boolean;
}

export async function runPipeline(options: RunPipelineOptions): Promise<AgendaOutput> {
  const { config, mock } = options;
  const targetDate = options.targetDate || new Date();

  // Step A: Select Source Adapters
  const adapters: SourceAdapter[] = mock
    ? [new MockAdapter()]
    : [new GoogleCalendarAdapter(), new TrelloAdapter()];

  // Step A & B: Ingestion & Parsing
  const rawItems = await ingestSources(adapters, targetDate, config);
  const parsedItems = parseItems(rawItems);

  // Step C: Deduplication & Conflict Resolution
  const dedupedItems = deduplicateItems(parsedItems);

  // Step D: Accessory Info Enrichment
  const enrichedItems = await enrichItems(dedupedItems, config);

  // Step E: Prioritization & Filtering
  const { events, tasks } = prioritizeAndFilterItems(enrichedItems, config);

  // Step F: Schema Formatting
  return formatOutput(targetDate, events, tasks);
}
