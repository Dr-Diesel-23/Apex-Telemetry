# ApexTelemetry — Backend

Node.js + Express + TypeScript backend for the ApexTelemetry motorsport dashboard
(Formula 1, Formula 2, MotoGP). It serves live race overview data, championship
standings, AI-style win probabilities, news, driver telemetry comparisons and a
2 Hz WebSocket telemetry feed.

```
                    ┌─────────────────────────────────────────────┐
  HTTP  ──────────▶ │  Express 5  /api/v1                         │
                    │   ├─ overview   (live, predictions, news)   │
                    │   ├─ standings  (drivers, constructors)     │
                    │   └─ telemetry  (compare)                   │
                    ├─────────────────────────────────────────────┤
                    │  Services                                   │
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
| `GET` | `/overview/live?series=f1` | Active session, circuit, live order, Open-Meteo weather |
| `GET` | `/overview/predictions?series=f1&racesRemaining=6` | Simulated win/podium/pole probabilities |
| `GET` | `/overview/news?series=motogp&limit=20` | News feed (optionally filtered by series) |
| `GET` | `/:series/standings/drivers` | Driver championship standings |
| `GET` | `/:series/standings/constructors` | Constructor/team standings |
| `GET` | `/:series/telemetry/compare?driver1=VER&driver2=NOR&limit=120` | Speed/gear/throttle comparison |
| `GET` | `/health` and `/api/v1/health` | Liveness + DB/WS status |

`:series` accepts `f1`, `f2`, `motogp` (case-insensitive; `formula-1`, `moto-gp`
also work). Invalid series return `400`.

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
      "teamName": "McLaren",
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
    "websocketPath": "/ws/telemetry"
  }
}
```

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
  "timestamp": "2026-10-28T15:00:23.500Z",
  "frames": [
    {
      "driverId": "cmvs…",
      "code": "VER",
      "driverNumber": 1,
      "fullName": "Max Verstappen",
      "teamName": "Red Bull Racing",
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
│  ├─ config/                # env (zod), prisma, series, reference data, colours
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
