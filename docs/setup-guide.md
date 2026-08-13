# Screamsheet Morning Aggregator — Setup & Credential Guide

This guide walks you through gathering all necessary API keys, tokens, and board/calendar IDs required to configure `config.json` for the **Screamsheet Morning Aggregator**.

---

## 1. Overview of Required Credentials

To aggregate data, the application reads a `config.json` file in the root directory (or passed via `--config <path>`). Here is a summary of what you need for each service:

| Service | Required Information | Where to Find / Generate |
| :--- | :--- | :--- |
| **Google Calendar** | `calendar_ids`, API Key or OAuth Access Token | Google Cloud Console |
| **Trello** | `api_key`, `token`, `board_id`, `list_id` | Trello Developer Portal |
| **Google Maps** | `api_key` | Google Cloud Console (Distance Matrix API) |

---

## 2. Setting Up Google Calendar

### Option A: Using a Google API Key (For Public Calendars)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Enable the **Google Calendar API** under **APIs & Services > Library**.
4. Navigate to **APIs & Services > Credentials** and click **Create Credentials > API Key**.
5. Copy the generated API key into your `.env` or `config.json`.

### Option B: Using OAuth2 / Service Account (For Private Calendars)
1. In Google Cloud Console, navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID** (or Service Account).
3. If using Service Account:
   - Download the JSON key file.
   - Share your private calendar(s) with the Service Account email address.
4. **Finding Calendar IDs**:
   - Open [Google Calendar](https://calendar.google.com/).
   - Click the three dots next to the calendar under "My calendars" -> **Settings and sharing**.
   - Scroll down to **Integrate calendar** to copy your **Calendar ID** (e.g., `primary` or `your_name@gmail.com` or `c_xxx...@group.calendar.google.com`).

---

## 3. Setting Up Trello API & IDs

### Step 1: Get your Trello API Key & User Token
1. Log in to Trello and visit [https://trello.com/app-key](https://trello.com/app-key) (Trello Power-Up Admin / Developer Portal).
2. Copy your **API Key**.
3. Next to the API Key, click the manually generated **Token** link to authorize read access.
4. Copy the generated **Token** (keep this secret!).

### Step 2: Get your Board ID & List IDs
1. Open the Trello board you want to aggregate in your browser.
2. Add `.json` to the end of the browser URL:
   - Example: `https://trello.com/b/AbCdEfGh/my-daily-board.json`
3. Press `Ctrl + F` and search for `"id"` at the top level of the JSON payload. This is your **`board_id`** (e.g. `60d5ec...`).
4. Search for `"lists": [` in the JSON file to find your list names and their corresponding IDs:
   - Look for `"name": "Today"` -> copy its `"id"` value (e.g. `60d5ec991122...`).
   - Look for `"name": "In Progress"` or `"Urgent"` -> copy its `"id"` value.

---

## 4. Setting Up Google Maps Distance Matrix API

The aggregator uses Google Maps to compute travel duration from your starting location to calendar event locations.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Distance Matrix API** under **APIs & Services > Library**.
3. Create an API Key under **APIs & Services > Credentials**.
4. (Recommended) Restrict the API key to only allow calls to the Distance Matrix API.
5. Copy the key to `maps.api_key` in `config.json`.

---

## 5. Configuring `config.json`

Copy `config.json.example` to `config.json` and fill in your credentials:

```json
{
  "max_tasks": 5,
  "output_directory": "C:/Users/Admin/Documents/screamsheet/incoming",
  "default_start_location": "123 Home St, Anytown, USA",
  "google_calendar": {
    "api_key": "YOUR_GOOGLE_CALENDAR_API_KEY",
    "calendar_ids": ["primary", "family@group.calendar.google.com"]
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

> **Note**: You can also use environment variables (`GOOGLE_CALENDAR_API_KEY`, `TRELLO_API_KEY`, `TRELLO_TOKEN`, `MAPS_API_KEY`) to keep secrets out of `config.json`.

---

## 6. Testing Without Live Credentials (Offline / Mock Mode)

You can run the aggregator in mock mode at any time without entering real keys:

```bash
npx tsx src/cli.ts --mock --dry-run
```

This will run the full pipeline against sample mock calendars and Trello cards and print the resulting `agenda-YYYY-MM-DD.json` payload directly to stdout.
