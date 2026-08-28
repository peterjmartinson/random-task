# Daily Agenda Aggregator — Setup & Credential Guide

This guide walks you through configuring `config.json` for the **Daily Agenda Aggregator**.

---

## 1. Overview of Required Credentials

To aggregate data, the application reads a `config.json` file in the root directory (or passed via `--config <path>`). Here is a summary:

| Service | Required Information | Where to Find / Generate |
| :--- | :--- | :--- |
| **Calendars (iCal / Google / Apple / Outlook)** | `ical_urls` *(Recommended)* | Google Calendar / Apple Calendar settings |
| **Trello** | `api_key`, `token`, `board_id`, `list_id` | Trello Developer Portal |
| **Google Maps** | `api_key` | Google Cloud Console (Distance Matrix API) |

---

## 2. Setting Up Calendars (iCal Feeds — Recommended)

The simplest and most reliable way to connect your calendars without dealing with Google Cloud Console OAuth verification is via **Secret iCal feeds**:

1. Open [Google Calendar](https://calendar.google.com/).
2. On the left sidebar under "My calendars", hover over your calendar, click the three dots **⋮**, and select **Settings and sharing**.
3. Scroll down to the **Integrate calendar** section.
4. Locate **"Secret address in iCal format"** and copy the URL:
   - Format looks like: `https://calendar.google.com/calendar/ical/your_name%40gmail.com/private-xxxxxxxx/basic.ics`
5. Paste this URL into `calendars.ical_urls` in `config.json`.
6. Repeat for each calendar you wish to sync (Personal, Family, School, Work, etc.).

---

## 3. Setting Up Trello API & IDs

### Step 1: Get your Trello API Key & User Token
1. Log in to Trello and visit [https://trello.com/app-key](https://trello.com/app-key).
2. Copy your **API Key**.
3. Next to the API Key, click the manually generated **Token** link to authorize read access.
4. Copy the generated **Token** (keep this secret!).

### Step 2: Get your Board ID & List IDs
1. Open the Trello board you want to aggregate in your browser.
2. Add `.json` to the end of the browser URL (e.g., `https://trello.com/b/AbCdEfGh/my-daily-board.json`).
3. Press `Ctrl + F` and search for `"id"` at the top level of the JSON payload. This is your **`board_id`**.
4. Search for `"lists": [` in the JSON file to find your target list IDs (e.g. `"name": "Today"`).

---

## 4. Setting Up Google Maps Distance Matrix API (Optional)

The aggregator uses Google Maps to compute drive times from your starting location to calendar event locations:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Distance Matrix API** under **APIs & Services > Library**.
3. Create an API Key under **APIs & Services > Credentials**.
4. Copy the key to `maps.api_key` in `config.json`.

---

## 5. Configuring `config.json`

Create/edit `config.json` in the project root:

```json
{
  "max_tasks": 5,
  "output_directory": "./output",
  "default_start_location": "123 Home St, Anytown, USA",
  "calendars": {
    "ical_urls": [
      "https://calendar.google.com/calendar/ical/peter.j.martinson%40gmail.com/private-xxxxxxx/basic.ics",
      "https://calendar.google.com/calendar/ical/family.../private-xxxxxxx/basic.ics"
    ]
  },
  "trello": {
    "api_key": "YOUR_TRELLO_API_KEY",
    "token": "YOUR_TRELLO_USER_TOKEN",
    "boards": [
      {
        "board_id": "YOUR_BOARD_ID",
        "lists": ["LIST_ID_TODAY", "LIST_ID_IN_PROGRESS"]
      }
    ],
    "include_past_due": true
  },
  "maps": {
    "enabled": true,
    "api_key": "YOUR_GOOGLE_MAPS_API_KEY"
  }
}
```

---

## 6. Running the Aggregator

```bash
# Run for today
npx tsx src/cli.ts

# Run for a specific date
npx tsx src/cli.ts --date 2026-08-28

# Offline mock dry-run
npx tsx src/cli.ts --mock --dry-run
```
