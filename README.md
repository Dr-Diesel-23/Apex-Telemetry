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
| Championship standings | `GET /api/v1/:series/standings/drivers` — OpenF1 for F1, Pulse Live for MotoGP |
| Session card (circuit, length, session type, mode) | `GET /api/v1/overview/live?series=f1` |
| Weather (track / air / rain) | same overview payload — OpenF1 track weather for F1, Open-Meteo otherwise |
| AI win probability | `GET /api/v1/overview/predictions?series=f1` |
| Tyre strategy | `GET /api/v1/f1/tyres` — OpenF1 stints + pit stops |
| Next race + countdown | `GET /api/v1/:series/schedule` — Jolpica (F1) / Pulse Live (MotoGP) |
| Circuit layout + corner art | `circuits.js` (local SVG data) |
| Race control feed | sample data (no public live race-control API) |

F1 and MotoGP are the supported series. The standings tabs, the series filter and
the WebSocket follow the selected series; the overview always shows the F1 desk.

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

## Circuit layouts

`circuits.js` holds a normalised SVG path (100x100 viewBox) for all 23 circuits
of the 2026 F1 calendar, plus a zoomed trace of each circuit's tightest corner.
The corner trace is painted faintly behind the "up next" card and the circuit
profile panel, replacing the old stock car photo.

The file is generated, not hand-edited:

```bash
node tools/build-circuits.mjs
```

Geometry comes from [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits)
(MIT), which is derived from OpenStreetMap contributors (ODbL). Circuits are
resolved from the names the API returns (`shortName`, `name`, id) via
`window.apexCircuitFor(...)`, so the layout follows the selected session. A
circuit without a layout shows `LAYOUT N/A` rather than a wrong map.

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
├── styles.css          # dark telemetry theme
├── tools/
│   └── build-circuits.mjs
└── server.js           # static file server (port 5173, /health)
```

No Formula 2 in the UI; the backend still exposes the routes.
