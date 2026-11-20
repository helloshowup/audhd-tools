# Five Days (Standalone Demo)

A 5-day horizon task planner grouped by concrete hand actions (`Say yes`, `Send a message`, `Pick one`, `Pay or move money`, `Write a thing`, `Sit at a screen`, `Get up and do it`).

## Run locally

Open `index.html` directly in a browser, or run a local server from the repository root:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/five-days/`.

## Standalone adaptation

My working copy reads and writes tasks in Neon Postgres and Google Calendar. This public folder swaps `fd-bridge.js` for a pure browser `localStorage` store pre-seeded with fictional sample tasks dated relative to today.

Last synced: November 2026
