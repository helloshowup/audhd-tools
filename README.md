# Tools for my week

Five small, standalone tools I built for my own week — shared here as-is to read, copy, or fork.

> **Boundary:** Built for my own week; shared to read, copy, or fork. I don't take feature requests, issues, or pull requests.

My working copies connect to private databases, calendars, and message threads. Each folder here is a clean, self-contained copy wired to browser `localStorage` or synthetic demo data so you can open and explore it with zero cloud setup or personal data.

Read the companion essay on [ndagency.digital/apps-i-built](https://ndagency.digital/apps-i-built).

---

## What is inside

| Folder | What it does | How to run locally |
|---|---|---|
| [`spoon-ledger/`](spoon-ledger/) | Daily energy capacity and medication check-ins (`localStorage`) | Open `spoon-ledger/index.html` in a browser (or serve locally) |
| [`five-days/`](five-days/) | Five-day horizon planner grouped by concrete hand actions (`localStorage`) | Open `five-days/index.html` in a browser (or serve locally) |
| [`goal-rings/`](goal-rings/) | Concentric 3-ring goal and priority map (`localStorage`) | Open `goal-rings/index.html` in a browser (or serve locally) |
| [`muscle-lookup/`](muscle-lookup/) | Tap-a-muscle strength exercise manual with zero streaks (`localStorage`) | Serve `muscle-lookup/` over HTTP (`npx serve muscle-lookup` or `python3 -m http.server`) |
| [`the-randlord/`](the-randlord/) | Zero-based envelope budget for irregular income (demo ledger) | `cd the-randlord && npm install && npm run dev` |

### Quickest way to open any of the four static folders

From the repository root, start a simple local web server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/five-days/`, `http://localhost:8000/spoon-ledger/`, `http://localhost:8000/goal-rings/`, or `http://localhost:8000/muscle-lookup/`.

*(The first three also open directly by double-clicking `index.html`. `muscle-lookup/` uses ES modules and `fetch('data/catalogue.json')`, which browsers only load over `http://localhost` rather than `file://`.)*

---

## Licence

[MIT](LICENSE)
