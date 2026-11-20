# Goal Rings (Standalone Demo)

Three concentric rings (`Inner / Mid / Outer`) for unknotting big, vague goals into concrete spatial branches — pre-seeded with a sample map and persisted in browser `localStorage`.

## Run locally

Open `index.html` directly in a browser, or run a local server from the repository root:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/goal-rings/`.

## Standalone adaptation

My working copy saves maps in Vercel Blob and expands nodes via a Replicate API proxy. This public copy saves maps and sessions in browser `localStorage`, boots with a sample 3-ring map, and exports clean Markdown outlines directly in the browser.

Last synced: November 2026
