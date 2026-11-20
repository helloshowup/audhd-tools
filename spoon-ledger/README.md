# Spoon Protocol Ledger (Standalone Demo)

Daily energy capacity, medication timing, and felt-cost check-ins — wired to browser `localStorage` with three pre-seeded sample days.

## Run locally

Open `index.html` directly in a browser, or run a local server from the repository root:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/spoon-ledger/`.

## Standalone adaptation

My working copy stores state in a private Vercel Blob endpoint (`/api/state`). This public folder stores everything directly in browser `localStorage` (`spoonledger:state:v2`).

Last synced: November 2026
