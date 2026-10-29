# ApexTelemetry — Backend

Node.js + Express + TypeScript backend for the ApexTelemetry motorsport dashboard
(Formula 1 and MotoGP). It serves live race overview data, championship
standings, AI-style win probabilities, news, driver telemetry comparisons and a
2 Hz WebSocket telemetry feed.

**Formula 1 is wired to live upstreams:** [OpenF1](https://api.openf1.org/v1) for
timing, car telemetry, championship points and track weather, with
[Open-Meteo](https://api.open-meteo.com/v1/forecast) for the database/MotoGP
paths and as a fallback. When no session is running, the last session's closing
laps are replayed at 2 Hz so the dashboard always shows real cars.

Every upstream is **free and key-less**: [Jolpica](https://api.jolpi.ca) (the
community Ergast successor) supplies the F1 race calendar and
[Pulse Live](https://api.motogp.pulselive.com/motogp/v1) (the public API behind
motogp.com) supplies real MotoGP standings and the MotoGP calendar. No sign-up,
no API key, no paid tier.

```
                    ┌─────────────────────────────────────────────┐
  HTTP  ──────────▶ │  Express 5  /api/v1                         │
                    │   ├─ overview   (live, predictions, news)   │
                    │   ├─ standings  (drivers, constructors)     │
                    │   └─ telemetry  (compare)                   │
                    ├─────────────────────────────────────────────┤
                    │  Services                                   │
                    │   ├─ OpenF1 → live F1 timing + telemetry    │
                    │   ├─ Prisma → PostgreSQL                    │
                    │   ├─ Open-Meteo (p-queue rate-limited)      │
                    │   ├─ Redis / in-memory cache                │
                    │   └─ deterministic race simulator           │
  WS 2 Hz ─────────▶ │  ws://…/ws/telemetry                        │
                    └─────────────────────────────────────────────┘
```

## Requirements

- Node.js **20+** (verified on Node 24)
- PostgreSQL **14+** (verified on PostgreSQL 16)

## Quick start

```bash
cd backend
npm install          # also runs `prisma generate` via postinstall

# 1a. Start PostgreSQL with Docker (or use an existing server)
docker compose up -d

# 1b. …or create the database manually (example using psql as superuser)
psql -U postgres -c "CREATE ROLE apex LOGIN PASSWORD 'apex' CREATEDB;"
psql -U postgres -c "CREATE DATABASE apex_telemetry OWNER apex;"

# 2. Configure environment
cp .env.example .env

# 3. Migrate and seed
npm run prisma:migrate      # or: npm run prisma:push
npm run seed

# 4a. Development (ts-node, hot reload via restart)
npm run dev

# 4b. Production build
npm run build
npm start
```

The server listens on `http://localhost:4000` by default.

### Dashboard

The static dashboard lives in `Frontend/` (zero dependencies, no build step):

```bash
cd Frontend
npm start            # serves http://127.0.0.1:5173
```

It renders from mock data first, then upgrades itself: standings from
`/:series/standings/drivers`, session/weather/predictions from
`/overview/*`, and the 2 Hz telemetry strip from `/ws/telemetry`. The API base
defaults to `http://localhost:4000/api/v1` and can be changed on the **API
config** page (persisted in `localStorage` as `apex-url`). If the backend is
unreachable the strip shows `RECONNECTING...` and the mock data stays on screen.

### Verify the install

```bash
curl http://localhost:4000/health
curl "http://localhost:4000/api/v1/overview/live"
node scripts/wsSmokeTest.js
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` / `test` / `production` |
| `PORT` | `4000` | HTTP + WebSocket port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | — | PostgreSQL connection string (**required**) |
| `REDIS_ENABLED` | `false` | Enable Redis-backed cache |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `OPEN_METEO_BASE_URL` | Open-Meteo forecast endpoint | Weather upstream |
| `WEATHER_CACHE_TTL_SECONDS` | `300` | Weather cache TTL |
| `OPENF1_ENABLED` | `true` | Use OpenF1 for live F1 data |
| `OPENF1_BASE_URL` | `https://api.openf1.org/v1` | OpenF1 API base |
| `OPENF1_TIMEOUT_MS` | `8000` | Per-request upstream timeout |
| `OPENF1_WINDOW_SECONDS` | `90` | Seconds of car data kept for live/replay |
| `JOLPICA_ENABLED` | `true` | Use Jolpica for the F1 calendar (no key) |
| `JOLPICA_BASE_URL` | `https://api.jolpi.ca/ergast/f1` | Jolpica API base |
| `MOTOGP_API_ENABLED` | `true` | Use Pulse Live for MotoGP standings/calendar (no key) |
| `MOTOGP_API_BASE_URL` | `https://api.motogp.pulselive.com/motogp/v1` | MotoGP API base |
| `SIMULATED_TELEMETRY` | `false` | Stream simulated frames when no session is live (demos only) |
| `WS_PATH` | `/ws/telemetry` | WebSocket route |
| `WS_BROADCAST_INTERVAL_MS` | `500` | Telemetry broadcast interval (2 Hz) |
| `CORS_ORIGIN` | `*` | Comma-separated allow-list, or `*` |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

Config is validated with Zod at boot — an invalid value stops the process with a
readable error instead of failing mid-request.

## REST API

Base URL: `/api/v1`

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/overview/live?series=f1` | Active session, circuit, live order, weather (OpenF1 for F1) |
| `GET` | `/overview/predictions?series=f1&racesRemaining=6` | Simulated win/podium/pole probabilities |
| `GET` | `/overview/news?series=motogp&limit=20` | News feed (optionally filtered by series) |
| `GET` | `/:series/standings/drivers` | Driver championship standings |
| `GET` | `/:series/standings/constructors` | Constructor/team standings |
| `GET` | `/:series/telemetry/compare?driver1=VER&driver2=NOR&limit=120` | Speed/gear/throttle comparison |
| `GET` | `/:series/tyres` | Tyre strategy: stints, compounds, laps per set, pit stops (F1) |
| `GET` | `/:series/schedule` | Season calendar with the next and last race (Jolpica / Pulse Live), each race carrying `countryCode` |
| `GET` | `/health` and `/api/v1/health` | Liveness + DB/WS status |

`:series` accepts `f1`, `f2`, `motogp` (case-insensitive; `formula-1`, `moto-gp`
also work). Invalid series return `400`. The dashboard exposes **F1 and MotoGP**;
the `f2` routes remain on the API for compatibility.

### Teams, names and flags

- **Official entrant names.** F1 team names are mapped from the timing-feed short
  names to the official 2026 entry list (`src/config/teamNames.ts`), so
  standings, tyres, the live feed and the WebSocket return
  `McLaren Mastercard F1 Team`, `Scuderia Ferrari HP`,
  `Mercedes-AMG PETRONAS Formula One Team`, `Oracle Red Bull Racing`,
  `Audi Revolut F1 Team`, `Cadillac Formula 1 Team`, … instead of `McLaren`,
  `Ferrari`, `Mercedes`. `shortTeamName()` provides the compact form for tight
  rows; team colours resolve through both spellings.
- **Driver identity.** Driver standings carry `code` and `driverNumber`, which the
  dashboard renders as the official timing identity: `(HAM-44)`, `(LEC-16)`,
  `(VER-3)`.
- **Constructors.** `/:series/standings/constructors` returns `name`, `points`,
  `gapToLeader`, `position` and `colorHex`. F1 uses the official entrant name;
  MotoGP team points are summed from the riders of each team.
- **Country flags.** Every `RaceSummary` in `/:series/schedule` (`next`, `last`
  and `races[]`) includes `countryCode` — the ISO 3166-1 alpha-2 code used by the
  dashboard to render `https://flagcdn.com/w40/{code}.png`. Jolpica only returns
  country names, so they are mapped in `src/config/countries.ts`; Pulse Live
  already supplies ISO-2 codes.

### Live data sources

| Series | Session + timing | Car telemetry | Weather |
| --- | --- | --- | --- |
| F1 | OpenF1 `/sessions`, `/position`, `/championship_drivers`, `/championship_teams` | OpenF1 `/car_data` | OpenF1 `/weather` |
| F1 tyres | OpenF1 `/stints`, `/pit` | - | - |
| F1 calendar | Jolpica `/current/races.json` (6 h cache) | - | - |
| MotoGP | Pulse Live `/results/standings`, `/results/events` (10 min cache) | deterministic simulator | Open-Meteo |
| any (fallback) | PostgreSQL + simulator | deterministic simulator | Open-Meteo |

OpenF1 and Pulse Live names are normalised before they reach the API: F1 teams
become their official 2026 entrant names and every race gets an ISO-2
`countryCode` for the dashboard flag.

How the F1 path behaves:

- **Live session** — the latest OpenF1 session is cached for 30 s; frames are
  read at "now" from the trailing `OPENF1_WINDOW_SECONDS` of car data.
- **Finished session** — the API replays the closing 90 s of real car data in a
  loop, anchored on the last `/position` update (not the scheduled `date_end`,
  which would replay parked cars). `meta.mode` is `"replay"`.
- **Rate limits** — every upstream call goes through a `p-queue` (1 at a time,
  ~2.5 req/s), 429/5xx responses are retried with exponential backoff and
  `Retry-After` support, and a per-endpoint failure only blanks that panel. If a
  panel fails, the previous copy from the same session is reused.
- **Wins / podiums** — not present in the championship feed, so they are counted
  from every completed race of the season in the background (scan lane at
  20 req/min, cached 6 h).
- **Fallback** — if OpenF1 is unreachable or returns no car data, the request
  falls back to PostgreSQL and the simulator, and `meta.source` becomes
  `"database"`.

### Examples

```bash
curl "http://localhost:4000/api/v1/f1/standings/drivers"
curl "http://localhost:4000/api/v1/f1/telemetry/compare?driver1=VER&driver2=NOR"
curl "http://localhost:4000/api/v1/overview/live"
```

`GET /api/v1/overview/live` (abridged):

```json
{
  "session": {
    "id": "seed_session_f1_race_silverstone",
    "series": "F1",
    "seriesLabel": "Formula 1",
    "sessionType": "RACE",
    "startTime": "2026-10-28T14:18:08.000Z",
    "isActive": true,
    "elapsedMinutes": 42.4,
    "progressPct": 47.1,
    "circuit": {
      "name": "Silverstone Circuit",
      "country": "United Kingdom",
      "latitude": 52.0786,
      "longitude": -1.0169,
      "lengthKm": 5.891
    }
  },
  "weather": {
    "source": "open-meteo",
    "airTempC": 13,
    "trackTempC": 12.5,
    "rainProbability": 0,
    "condition": "Overcast"
  },
  "leaderboard": [
    {
      "position": 1,
      "code": "NOR",
      "fullName": "Lando Norris",
      "teamName": "McLaren Mastercard F1 Team",
      "teamColor": "#FF8000",
      "speed": 310.7,
      "rpm": 12900,
      "gear": 8,
      "throttle": 63.6,
      "brake": 0,
      "drs": false,
      "championshipPosition": 2,
      "points": 401
    }
  ],
  "meta": {
    "generatedAt": "2026-10-28T15:00:23.000Z",
    "degraded": false,
    "databaseOnline": true,
    "cache": "memory",
    "sampleRateHz": 2,
    "websocketPath": "/ws/telemetry",
    "source": "openf1",
    "mode": "replay",
    "sessionKey": 11396
  }
}
```

`meta.source` is `"openf1"` when the payload came from the live feed and
`"database"` when it came from PostgreSQL/simulation. In replay mode the
`session.circuit` is enriched from the reference table (coordinates and track
length), because OpenF1 only ships a short circuit name.

`GET /api/v1/f1/telemetry/compare?driver1=VER&driver2=NOR` returns two
`drivers[]` objects with `stats` (`maxSpeed`, `avgSpeed`, `topGear`,
`drsUsagePct`, …) and a `samples[]` array (`timestamp`, `speed`, `rpm`, `gear`,
`throttle`, `brake`, `drs`), plus a `delta` summary. Pass `sessionId` to compare
inside a specific session.

### Errors

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid query parameters.",
    "details": [{ "path": "driver2", "message": "Required", "code": "invalid_type" }]
  }
}
```

Codes: `VALIDATION_ERROR`, `BAD_REQUEST`, `NOT_FOUND`, `ROUTE_NOT_FOUND`,
`DATABASE_UNAVAILABLE`, `PRISMA_*`, `INTERNAL_SERVER_ERROR`.

## WebSocket

Endpoint: `ws://localhost:4000/ws/telemetry?series=f1` (defaults to the active
series). Broadcasts **2 snapshots per second** (`WS_BROADCAST_INTERVAL_MS=500`).

Handshake message:

```json
{
  "type": "connected",
  "clientId": "ws_ab12cd34",
  "series": "F1",
  "sampleRateHz": 2,
  "availableSeries": ["F1", "F2", "MOTOGP"]
}
```

Snapshot:

```json
{
  "type": "telemetry.snapshot",
  "seq": 42,
  "series": "F1",
  "seriesLabel": "Formula 1",
  "sampleRateHz": 2,
  "source": "openf1",
  "live": true,
  "timestamp": "2026-10-28T15:00:23.500Z",
  "frames": [
    {
      "driverId": "cmvs…",
      "code": "VER",
      "driverNumber": 1,
      "fullName": "Max Verstappen",
      "teamName": "Oracle Red Bull Racing",
      "teamColor": "#3671C6",
      "speed": 267.4,
      "rpm": 11230,
      "gear": 7,
      "throttle": 54.5,
      "brake": 0,
      "drs": false,
      "timestamp": "2026-10-28T15:00:23.500Z"
    }
  ]
}
```

Client → server:

- `{"type":"subscribe","series":"motogp"}` → `{"type":"subscribed",...}`
- `{"type":"ping"}` → `{"type":"pong","timestamp":"…"}`

`source` is `"openf1"` for real F1 frames and `"simulation"` when the fallback
generator produced them.

**Live-only feed.** Frames are only broadcast while a session is actually
running. With no live session the snapshot carries `"live": false`,
`"source": "idle"` and `"frames": []`, and the dashboard renders a
`NO LIVE SESSION` state instead of animating historical data. Set
`SIMULATED_TELEMETRY=true` to fall back to the deterministic simulator
(demos/offline development); those frames are still marked `"live": false`.

Heartbeat pings run every 30 s; dead sockets are terminated.

Browser example:

```js
const ws = new WebSocket('ws://localhost:4000/ws/telemetry?series=f1');
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.type === 'telemetry.snapshot') renderTelemetry(message.frames);
};
```

## Data model

```
Driver ──┐                        Circuit ──┐
         ├──< Telemetry >── Session ─────────┤
         │                    └──< WeatherLog
Constructor (team standings)     NewsItem
```

- `Telemetry` has the compound index `(sessionId, driverId, timestamp)` — the hot
  path for replaying a driver's last N samples.
- `Driver.code` and `Constructor.name` are unique.
- Enums: `Series { F1, F2, MOTOGP }`,
  `SessionType { PRACTICE, QUALIFYING, SPRINT, RACE }`.

The seed writes 17 drivers, 13 teams, 12 circuits, 6 sessions, **100 telemetry
points**, 18 weather logs and 8 news items. The F1 race at Silverstone is the
active session; `VER`, `NOR`, `PIA`, `LEC`, `HAM`, `RUS` all have stored samples.

## Design notes

- **Graceful degradation.** If PostgreSQL is unreachable or a table is empty, the
  services fall back to the reference grid in `src/config/referenceData.ts` and
  mark the response with `degraded: true`. The dashboard stays usable; `/health`
  reports `"status": "degraded"` and `database.status: "down"`. A circuit breaker
  short-circuits queries for 15 s after a connectivity failure (no per-request
  connection timeouts) and a background probe reconnects automatically.
- **Weather.** Open-Meteo is fetched per circuit and cached (Redis when enabled,
  otherwise in-process) for `WEATHER_CACHE_TTL_SECONDS`. Requests go through a
  `p-queue` (4 concurrent / 8 per second). If the upstream fails, a deterministic
  fallback snapshot is returned with `source: "fallback"`.
- **Predictions.** `ApexRaceSim` blends points share, win/podium ratios and a
  seeded form index through a softmax. Output is deterministic inside a 15-minute
  bucket, so polling clients don't see jitter. Clearly labelled `simulated: true`.
- **Telemetry simulation.** `simulateFrame()` derives speed from layered sine
  waves per driver, then gear, RPM, throttle, brake and DRS from the speed
  derivative. Same timestamp ⇒ same frame, which keeps the WebSocket feed and
  the REST fallback consistent.
- **Observability.** Structured JSON logs (`http.request`, `ws.client_connected`,
  `database.*`, `weather.*`), request duration, and health endpoint.
- **Shutdown.** `SIGINT`/`SIGTERM` close the WS server, drain HTTP, disconnect
  Prisma/Redis, with a 10 s force-exit guard.

## Testing

The suite uses **Vitest** + **Supertest** (REST) and the `ws` client (real-time).

```bash
npm test              # full suite: 25 tests, ~15 s
npm run test:watch    # watch mode
npm run test:api      # REST only
npm run test:ws       # WebSocket only
```

`tests/globalSetup.ts` provisions an isolated database automatically:

1. creates `apex_telemetry_test` if missing,
2. applies `prisma/migrations`,
3. runs the real `prisma/seed.ts`.

It never touches your development database. Override the target with
`TEST_DATABASE_URL` and the admin connection with `TEST_DATABASE_ADMIN_URL`.

What is covered:

| Area | Assertions |
| --- | --- |
| Health | DB/WS status, API index |
| `overview/live` | active session, circuit, weather shape, 6-driver grid, series filter, 400s |
| `overview/predictions` | 6 entries, softmax sums to ~100, ordering, favourites, 400 |
| `overview/news` | limit, series filter, newest-first ordering, validation |
| Standings | ordering, gaps, positions, colours, aliases, unknown series |
| Telemetry compare | 10 stored samples, stats, delta, `limit`, 404/400 paths |
| WebSocket | handshake, 2 Hz cadence, frame shape, subscribe switch, ping/pong, bad series |

`tsconfig.test.json` type-checks the tests as part of `npm run typecheck`.

Tests run with `OPENF1_ENABLED=false` (see `vitest.config.mts`), so the suite
never depends on a third-party API being reachable or on the current race
calendar. `SIMULATED_TELEMETRY=true` keeps the WebSocket cadence/frame-shape
tests deterministic; production defaults to live-only. OpenF1 behaviour is
covered by the manual checks in [Live data sources](#live-data-sources).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run with ts-node |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type-check source **and** tests |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:api` | REST integration tests |
| `npm run test:ws` | WebSocket integration tests |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Create/apply dev migration |
| `npm run prisma:push` | Push schema without a migration |
| `npm run prisma:studio` | Prisma Studio |
| `npm run seed` | Seed the database (idempotent) |
| `node scripts/wsSmokeTest.js` | Verify the 2 Hz WebSocket feed |

## Project structure

```
backend/
├─ prisma/
│  ├─ schema.prisma          # models, enums, indexes
│  ├─ migrations/            # generated SQL
│  └─ seed.ts                # 100 telemetry points + reference grid
├─ prisma.config.ts          # Prisma 6.19+ config (seed hook)
├─ scripts/wsSmokeTest.js
├─ tests/
│  ├─ globalSetup.ts         # creates + migrates + seeds the test DB
│  ├─ api.test.ts            # REST integration suite
│  └─ websocket.test.ts      # WS handshake/cadence/subscribe suite
├─ src/
│  ├─ app.ts                 # Express wiring, CORS, health
│  ├─ server.ts              # HTTP + WS bootstrap, graceful shutdown
│  ├─ config/                # env (zod), prisma, series, reference data, team names, colours
│  ├─ controllers/           # thin HTTP handlers
│  ├─ middleware/            # error handler, request logger, query validation
│  ├─ routes/                # /overview, /:series/standings, /:series/telemetry
│  ├─ services/              # business logic + cache/weather/predictions
│  ├─ utils/                 # logger, HttpError, asyncHandler, PRNG
│  └─ websocket/telemetry.ws.ts
├─ .env / .env.example
├─ tsconfig.json / tsconfig.test.json
├─ vitest.config.mts
└─ package.json
```
