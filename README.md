# ApexTelemetry

Race intelligence dashboard for **Formula 1** and **MotoGP** — live timing,
telemetry, championship standings, tyre strategy, circuit profiles and an
AI-style win model, all fed by free, key-less public APIs.

```
backend/    Node 20 + Express 5 + TypeScript + Prisma/PostgreSQL + WebSocket
Frontend/   Zero-dependency static dashboard (HTML/CSS/JS, no build step)
```

## Quick start

**1. Backend** (port 4000)

```bash
cd backend
npm install                 # also runs prisma generate
cp .env.example .env        # set DATABASE_URL
npm run prisma:migrate
npm run seed
npm run build && npm start  # or: npm run dev
```

**2. Dashboard** (port 5173)

```bash
cd Frontend
npm start                   # http://127.0.0.1:5173
```

The dashboard renders from mock data immediately, then upgrades itself from the
API. If the backend is unreachable it keeps the mock data and retries.

## Data sources

Every upstream is free and key-less:

| Source | Used for |
| --- | --- |
| [OpenF1](https://api.openf1.org/v1) | F1 sessions, timing, car telemetry, stints, weather |
| [Jolpica](https://api.jolpi.ca) | F1 race calendar |
| [Pulse Live](https://api.motogp.pulselive.com/motogp/v1) | MotoGP standings and calendar |
| [Open-Meteo](https://api.open-meteo.com) | Weather (database/MotoGP paths, fallback) |
| [flagcdn](https://flagcdn.com) | Country flags in the next-race bar |
| Wikimedia Commons / Wikipedia | Circuit photos and official team logos (CC / fair use) |

Graceful degradation everywhere: upstream failure falls back to PostgreSQL, then
to deterministic simulation, and every panel keeps its last good copy.

## Features

- **Live telemetry strip** at 2 Hz over `/ws/telemetry` — real cars only while a
  session is running; otherwise `NO LIVE SESSION`.
- **Championship standings** with DRIVERS / CONSTRUCTORS toggle, official 2026
  entrant names, driver identities (`(HAM-44)`) and official team logos.
- **Tyre strategy** — stint chains, Pirelli sidewall colours, pit-lane times.
- **Circuit profile** — generated SVG layout map for all 23 circuits.
- **Next race** — countdown, circuit, weather and country flag.
- **AI win probability** — deterministic, seeded model.

## Documentation

- [Backend README](backend/README.md) — API reference, environment, WebSocket,
  data model, tests.
- [Frontend README](Frontend/README.md) — panels, data sources, asset
  generators, behaviour.

## Branches

`main` carries the full monorepo. `Backend` and `Frontend` are split branches
with each part at the repository root.

## Licence / trademarks

Team names, logos and circuit photographs are the property of their respective
owners and are used here for identification and editorial purposes only.
