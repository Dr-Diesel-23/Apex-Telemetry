import axios from 'axios';
import { env } from '../config/env';
import { countryCode } from '../config/countries';
import { logger } from '../utils/logger';
import type { RaceSummary, ScheduleResult } from './calendar.types';

/**
 * Jolpica (https://api.jolpi.ca) is the community-run successor to Ergast.
 * No API key, no sign-up, ~4 requests/second.
 *
 * We use it for the F1 race calendar so the dashboard can show the next Grand
 * Prix instead of only the last session. The calendar changes rarely, so it is
 * cached for six hours.
 */

const TTL_MS = 6 * 60 * 60_000;

const http = axios.create({
  baseURL: env.JOLPICA_BASE_URL,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});

interface ErgastRace {
  round: string;
  raceName: string;
  date: string;
  time?: string;
  url?: string;
  Circuit: {
    circuitName: string;
    Location: { locality: string; country: string };
  };
}

interface ErgastResponse {
  MRData?: {
    RaceTable?: {
      season?: string;
      Races?: ErgastRace[];
    };
  };
}

let cache: ScheduleResult | null = null;
let cachedAt = 0;
let inflight: Promise<ScheduleResult | null> | null = null;

function statusFor(startsAt: string | null, date: string): RaceSummary['status'] {
  const start = startsAt ? Date.parse(startsAt) : Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start)) return 'upcoming';

  const now = Date.now();
  if (now < start) return 'upcoming';
  // A Grand Prix is over within roughly three hours of lights-out.
  if (now <= start + 3 * 60 * 60_000) return 'live';
  return 'finished';
}

function mapRace(row: ErgastRace): RaceSummary {
  const startsAtRaw = row.time ? `${row.date}T${row.time}` : null;
  const startsAt =
    startsAtRaw && Number.isFinite(Date.parse(startsAtRaw))
      ? new Date(startsAtRaw).toISOString()
      : null;

  return {
    round: Number(row.round),
    name: row.raceName,
    shortName: null,
    circuit: row.Circuit.circuitName,
    locality: row.Circuit.Location.locality,
    country: row.Circuit.Location.country,
    countryCode: countryCode(row.Circuit.Location.country),
    startsAt,
    date: row.date,
    status: statusFor(startsAt, row.date),
  };
}

async function fetchCalendar(): Promise<ScheduleResult | null> {
  const response = await http.get<ErgastResponse>('/current/races.json');
  const table = response.data?.MRData?.RaceTable;
  const rows = table?.Races;

  if (!Array.isArray(rows) || rows.length === 0) return null;

  const races = rows.map(mapRace).sort((a, b) => a.round - b.round);
  const season = Number(table?.season) || new Date().getUTCFullYear();

  return {
    series: 'F1',
    season,
    next: races.find((race) => race.status === 'upcoming') ?? null,
    last: [...races].reverse().find((race) => race.status !== 'upcoming') ?? null,
    races,
    updatedAt: new Date().toISOString(),
    source: 'jolpica',
  };
}

/** F1 calendar from Jolpica, cached for six hours. `null` when unavailable. */
export async function getF1Schedule(): Promise<ScheduleResult | null> {
  if (!env.JOLPICA_ENABLED) return null;
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = fetchCalendar()
    .then((result) => {
      if (result) {
        cache = result;
        cachedAt = Date.now();
        logger.info('jolpica.calendar_loaded', {
          season: result.season,
          races: result.races.length,
          next: result.next?.name ?? null,
        });
      }
      return result ?? cache;
    })
    .catch((error: unknown) => {
      logger.warn('jolpica.calendar_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Test/ops hook. */
export function resetJolpicaCache(): void {
  cache = null;
  cachedAt = 0;
  inflight = null;
}
