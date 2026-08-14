#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { loadConfig } from './config/config.loader.js';
import { runPipeline } from './pipeline/index.js';

const program = new Command();

program
  .name('agenda-aggregator')
  .description('Aggregates Google Calendar and Trello items into unified daily agenda JSON')
  .version('1.0.0')
  .option('-c, --config <path>', 'Path to config.json file', 'config.json')
  .option('-d, --date <YYYY-MM-DD>', 'Target date for agenda (defaults to today)')
  .option('-o, --output-dir <path>', 'Override output directory')
  .option('-m, --mock', 'Use mock data adapters (offline mode)', false)
  .option('--dry-run', 'Print output JSON to stdout without writing to disk', false)
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);

      if (options.outputDir) {
        config.output_directory = options.outputDir;
      }

      let targetDate = new Date();
      if (options.date) {
        const parsedDate = new Date(options.date);
        if (isNaN(parsedDate.getTime())) {
          console.error(`Error: Invalid date format "${options.date}". Expected YYYY-MM-DD.`);
          process.exit(1);
        }
        targetDate = parsedDate;
      }

      const agendaOutput = await runPipeline({
        config,
        targetDate,
        mock: options.mock,
      });

      const outputJsonString = JSON.stringify(agendaOutput, null, 2);

      if (options.dryRun) {
        console.log(outputJsonString);
        return;
      }

      // Execution & Transport: Write file to output_directory
      const outputDir = path.resolve(process.cwd(), config.output_directory);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const fileName = `agenda-${agendaOutput.date}.json`;
      const filePath = path.join(outputDir, fileName);

      fs.writeFileSync(filePath, outputJsonString, 'utf-8');
      console.log(`Successfully generated agenda file: ${filePath}`);
    } catch (error) {
      console.error(`Pipeline execution failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
