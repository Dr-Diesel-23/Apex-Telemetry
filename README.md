# ApexTelemetry — Dashboard

Zero-dependency static dashboard for the ApexTelemetry backend. No build step,
no framework: plain HTML/CSS/JS served by a ~70-line Node static server.

```bash
npm start            # http://127.0.0.1:5173
PORT=8080 npm start  # custom port
```

Start the backend first (`../backend`, `npm start`, port 4000).

## What is live

| Panel | Source |
| --- | --- |
| Live telemetry strip (2 Hz) | `ws://localhost:4000/ws/telemetry?series=f1` — real OpenF1 car data for F1, simulation for MotoGP |
| Championship standings | `GET /api/v1/:series/standings/drivers` — real OpenF1 points, wins and podiums for F1 |
| Session card (circuit, length, session type, mode) | `GET /api/v1/overview/live?series=f1` |
| Weather (track / air / rain) | same overview payload — OpenF1 track weather for F1, Open-Meteo otherwise |
| AI win probability | `GET /api/v1/overview/predictions?series=f1` |
| Race control feed | sample data (no public live race-control API) |

F1 and MotoGP are the supported series. The standings tabs, the series filter and
the WebSocket follow the selected series; the overview always shows the F1 desk.

When OpenF1 has no session running, the backend replays the closing laps of the
last session, so the strip keeps moving with real speeds. The session card
reports `SESSION MODE — REPLAY` in that case.

## Behaviour

- **Offline first.** `app.js` renders from built-in mock data immediately, so the
  dashboard never shows a blank page. `live.js` then replaces it with API data.
- **Fallbacks.** A failed request only blanks its own panel; the mock data stays.
  If the WebSocket drops, the strip shows `RECONNECTING...` and retries with
  exponential backoff (1 s → 10 s).
- **API base.** Defaults to `http://localhost:4000/api/v1`. Change it on the
  **API config** page; it is stored in `localStorage` as `apex-url` and picked up
  within two seconds without a reload. WebSocket URLs are derived from it.
- **Refresh.** Standings reload every 60 s; the telemetry strip is pushed at
  2 Hz.

## Files

```
Frontend/
├─ index.html   # shell, navigation, series filter
├─ app.js       # mock data, render functions, routing
├─ live.js      # REST + WebSocket adapter (standings, session, weather, predictions)
├─ styles.css   # dark telemetry theme
└─ server.js    # static file server (no dependencies)
```
