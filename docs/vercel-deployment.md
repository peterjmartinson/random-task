# Vercel Deployment & API Guide

This guide explains how to host the Daily Agenda Aggregator as a serverless REST API on Vercel and run it locally for testing.

---

## ⚡ How the Vercel API Works

The Vercel deployment exposes a single serverless endpoint:
* **Endpoint**: `POST /api/agenda`
* **Purpose**: Aggregates calendar events and Trello tasks in-memory on demand.
* **CORS**: Enabled for all origins (`*`) so your `screensheet` client or any dashboard project can fetch the data directly.

### Request Body (`POST`)
You send the contents of your `config.json` in the HTTP request body. This allows you to run the scraper without committing your private credentials (like Google Calendar API keys or Trello tokens) to the git repository.

*Example Payload:*
```json
{
  "max_tasks": 5,
  "calendars": {
    "ical_urls": [
      "https://calendar.google.com/calendar/ical/user%40gmail.com/private-xxxx/basic.ics"
    ]
  },
  "trello": {
    "api_key": "YOUR_TRELLO_API_KEY",
    "token": "YOUR_TRELLO_TOKEN",
    "boards": [
      {
        "name": "To Do",
        "board_id": "YOUR_BOARD_ID",
        "lists": ["YOUR_LIST_ID"]
      }
    ]
  }
}
```

### Query Parameters (Optional)
* `date`: Target date in `YYYY-MM-DD` format (defaults to the current date). E.g. `/api/agenda?date=2026-08-28`
* `mock`: Set to `true` to use mock data for testing or offline dry-runs. E.g. `/api/agenda?mock=true`

---

## 🚀 Deployment Instructions

### Method 1: Vercel Git Integration (Recommended)
This is the easiest setup. Vercel automatically deploys every commit to your main branch.

1. Go to the [Vercel Dashboard](https://vercel.com).
2. Click **Add New** > **Project**.
3. Import your GitHub repository (`peterjmartinson/random-task`).
4. Keep the default settings (Vercel automatically detects the project type).
5. (Optional) Under **Environment Variables**, you can pre-define credentials like:
   - `GOOGLE_CALENDAR_API_KEY`
   - `TRELLO_API_KEY`
   - `TRELLO_TOKEN`
   - `MAPS_API_KEY`
   *If specified here, you can omit these keys from the screensheet config POST body.*
6. Click **Deploy**.

---

### Method 2: Vercel CLI Deployment
You can deploy directly from your local terminal.

1. Install the Vercel CLI globally if you haven't already:
   ```bash
   npm install -g vercel
   ```
2. Log in to Vercel:
   ```bash
   vercel login
   ```
3. Run the deployment command from the project root:
   ```bash
   vercel
   ```
4. Follow the prompts. To deploy to production, run:
   ```bash
   vercel --prod
   ```

---

## 🛠️ Local Development & Testing

You can simulate the Vercel serverless environment locally.

1. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```
2. Run the local dev server:
   ```bash
   npx vercel dev
   ```
   This spins up a local server (typically at `http://localhost:3000`).

3. Send a test POST request with PowerShell (Windows):
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/api/agenda?mock=true" -Method Post -ContentType "application/json" -Body '{}'
   ```
   *Or with curl (UNIX):*
   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{}' "http://localhost:3000/api/agenda?mock=true"
   ```

---

## 🌐 Custom Domain Setup (`distractedfortune.com`)

To map this API to a subdomain of your GitHub Pages blog:

1. In your **Vercel Project Dashboard**, navigate to **Settings** > **Domains**.
2. Add your desired subdomain, for example: `api.distractedfortune.com`.
3. Vercel will provide the DNS records (usually a CNAME pointing to `cname.vercel-dns.com`).
4. Log into your DNS provider (e.g. Namecheap, Cloudflare, GoDaddy) and add the CNAME record.
5. Once DNS propagates, your screensheet project can hit `https://api.distractedfortune.com/agenda`.
