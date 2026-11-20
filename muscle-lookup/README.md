# Muscle Look-up (Standalone Demo)

A tap-a-muscle strength exercise manual with zero streaks, zero notifications, and zero workout plans telling you what today demands.

## Run locally

Because `index.html` uses ES modules (`app.js`) and fetches `data/catalogue.json`, serve the folder over HTTP rather than `file://`:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/muscle-lookup/`.

Last synced: November 2026
