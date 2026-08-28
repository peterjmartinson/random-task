import { VercelRequest, VercelResponse } from '@vercel/node';
import { runPipeline } from '../src/pipeline/index.js';
import { AppConfigSchema } from '../src/config/config.schema.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle CORS Preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests for security and data passing
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    return;
  }

  try {
    const rawConfig = req.body || {};

    // Fallback: Merge environment variables if they are missing in the request body
    if (!rawConfig.google_calendar?.api_key && process.env.GOOGLE_CALENDAR_API_KEY) {
      rawConfig.google_calendar = {
        ...rawConfig.google_calendar,
        api_key: process.env.GOOGLE_CALENDAR_API_KEY,
      };
    }
    if (!rawConfig.trello?.api_key && process.env.TRELLO_API_KEY) {
      rawConfig.trello = {
        ...rawConfig.trello,
        api_key: process.env.TRELLO_API_KEY,
      };
    }
    if (!rawConfig.trello?.token && process.env.TRELLO_TOKEN) {
      rawConfig.trello = {
        ...rawConfig.trello,
        token: process.env.TRELLO_TOKEN,
      };
    }
    if (!rawConfig.maps?.api_key && process.env.MAPS_API_KEY) {
      rawConfig.maps = {
        ...rawConfig.maps,
        api_key: process.env.MAPS_API_KEY,
      };
    }

    // Validate the parsed configuration
    const parseResult = AppConfigSchema.safeParse(rawConfig);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid configuration body schema.',
        details: parseResult.error.format(),
      });
      return;
    }

    const config = parseResult.data;

    // Parse target date from query parameters or default to current date
    let targetDate = new Date();
    if (req.query.date) {
      const parsedDate = new Date(req.query.date as string);
      if (isNaN(parsedDate.getTime())) {
        res.status(400).json({ error: 'Invalid date parameter. Use YYYY-MM-DD.' });
        return;
      }
      targetDate = parsedDate;
    }

    // Support mock parameter for dry-run testing via API query string
    const useMock = req.query.mock === 'true' || req.body.mock === true;

    // Execute the main aggregator pipeline
    const agendaOutput = await runPipeline({
      config,
      targetDate,
      mock: useMock,
    });

    res.status(200).json(agendaOutput);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to aggregate daily agenda.',
      message: (error as Error).message,
    });
  }
}
