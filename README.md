# ApexTelemetry — Dashboard

Zero-dependency static dashboard for the ApexTelemetry backend. No build step,
no framework: plain HTML/CSS/JS served by a small Node static server.

```bash
npm start            # http://127.0.0.1:5173
PORT=8080 npm start  # custom port
```

Start the backend first (`../backend`, `npm start`, port 4000).

## What is live

| Panel | Source |
| --- | --- |
| Live telemetry strip (2 Hz) | `ws://localhost:4000/ws/telemetry?series=f1` — real OpenF1 car data, **only while a session is running** |
| Championship standings | `GET /api/v1/:series/standings/drivers` / `.../constructors` — OpenF1 for F1, Pulse Live for MotoGP |
| Session card (circuit, length, session type, mode) | `GET /api/v1/overview/live?series=f1` |
| Weather (track / air / rain) | same overview payload — OpenF1 track weather for F1, Open-Meteo otherwise |
| AI win probability | `GET /api/v1/overview/predictions?series=f1` |
| Tyre strategy | `GET /api/v1/f1/tyres` — OpenF1 stints + pit stops |
| Next race + countdown | `GET /api/v1/:series/schedule` — Jolpica (F1) / Pulse Live (MotoGP) |
| Next-race country flag | `flagcdn.com` (`w40/{iso2}.png`), code from the schedule payload |
| Circuit layout | `circuits.js` (SVG map) — the profile panel is map-only |
| Session card photo | `corners.js` (real signature-corner photo, CC attribution) |
| Race control feed | sample data (no public live race-control API) |

F1 and MotoGP are the supported series. The standings tabs, the series filter and
the WebSocket follow the selected series; the overview always shows the F1 desk.

## Championship standings

The panel has two independent switches:

- **F1 / MotoGP** — which championship.
- **DRIVERS / CONSTRUCTORS** — which table.

Drivers are labelled with their official timing identity and number, e.g.
`Lewis Hamilton (HAM-44)`, and their full 2026 entrant name
(`Scuderia Ferrari HP`, `Audi Revolut F1 Team`, `McLaren Mastercard F1 Team`, …).
The constructors table shows rank, team, points and gap to the leader, with each
team's colour stripe.

## Live telemetry only when the race is live

The backend sends `"live": true` only while a session is actually running. With
no live session the snapshot is `"live": false`, `"source": "idle"` with an empty
frame list, and the strip renders **NO LIVE SESSION** instead of replaying old
cars. Standings, tyre strategy and the next-race countdown stay available, and
the session card reports `SESSION MODE — REPLAY`.

## Tyre strategy

`GET /f1/tyres` returns, per driver: every stint (compound, start/end lap, laps
on that set, tyre age at start), the current compound, and pit stops with
pit-lane time. The panel renders Pirelli-style sidewall pills:

| Pill | Compound | Colour |
| --- | --- | --- |
| **S** | Soft | `#FF3333` |
| **M** | Medium | `#FFD400` |
| **H** | Hard | `#F2F2F2` |
| **I** | Intermediate | `#43B02A` |
| **W** | Wet | `#2E7DD1` |

A row reads like `M 24 › H 32 — 32 LAPS ON H — 1 STOP · 23.5S`: the stint chain,
the age of the current set and the last pit-lane time.

## Circuit profile: layout map

The circuit profile panel shows the SVG track map and the track facts — no
photograph. The "up next" session card still uses a real photograph of the
circuit's signature corner as a full-bleed background at **full brightness**
(`opacity: 1`, no overlay or blur); the panel copy uses a text shadow so it stays
readable over the image.

Both assets are generated, not hand-edited:

```bash
node tools/build-circuits.mjs   # layouts  → circuits.js
node tools/build-corners.mjs    # photos   → corners.js
```

- **Layouts** (`circuits.js`) — a normalised SVG path (100x100 viewBox) for all
  23 circuits of the 2026 F1 calendar, plus a zoomed trace of each circuit's
  tightest corner. Geometry comes from
  [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT), derived
  from OpenStreetMap contributors (ODbL). A circuit without a layout shows
  `LAYOUT N/A` rather than a wrong map.
- **Photos** (`corners.js`) — one real, CC-licensed photograph per circuit from
  Wikimedia Commons / Wikipedia, used by the session card. The builder searches
  Commons for the corner, then the circuit's own Commons category, then the
  Wikipedia lead image, and rejects maps, logos and non-JPEG artwork. `madring`
  has no free photograph and keeps the SVG trace.

Every photo carries `title`, `credit` and `license`, rendered under the image as
`PHOTO — TURN 1 · CC BY-SA 4.0 · HoverVan`. Circuits are resolved from the names
the API returns (`shortName`, `name`, id) via `window.apexCircuitFor(...)` and
`window.apexCornerFor(...)`, so both the photo and the map follow the selected
session.

## Behaviour

- **Offline first.** `app.js` renders from built-in mock data immediately, so the
  dashboard never shows a blank page. `live.js` then replaces it with API data.
- **Fallbacks.** A failed request only blanks its own panel; the mock data stays.
  If the WebSocket drops, the strip shows `RECONNECTING...` and retries with
  exponential backoff (1 s → 10 s).
- **API base.** Defaults to `http://localhost:4000/api/v1`. Change it on the
  **API config** page; it is stored in `localStorage` as `apex-url` and picked up
  within two seconds without a reload. WebSocket URLs are derived from it.
- **Render safety.** `live.js` patches panels after `app.js` re-renders, driven
  by a `MutationObserver`. Every write is guarded (stamp/compare) so the observer
  can never retrigger itself — an unguarded `textContent` write there freezes the
  tab.

## Files

```
Frontend/
├── index.html          # shell (sidebar, header, content mount)
├── app.js              # render layer: pages, panels, tables, tyre rows
├── live.js             # API/WS adapter: standings, telemetry, tyres, schedule
├── circuits.js         # generated circuit layouts + corner traces
├── corners.js          # generated signature-corner photos + attribution
├── styles.css          # deep-black telemetry theme
├── tools/
│   ├── build-circuits.mjs   # OSM layouts → circuits.js
│   └── build-corners.mjs    # Commons/Wikipedia photos → corners.js
└── server.js           # static file server (port 5173, /health)
```

No Formula 2 in the UI; the backend still exposes the routes.
