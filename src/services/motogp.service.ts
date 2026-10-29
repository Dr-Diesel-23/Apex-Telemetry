import axios from 'axios';
import { env } from '../config/env';
import { countryCode } from '../config/countries';
import { logger } from '../utils/logger';
import type { RaceSummary, ScheduleResult } from './calendar.types';

/**
 * MotoGP results + standings from the public Pulse Live API that powers
 * motogp.com (`api.motogp.pulselive.com`). It needs no key.
 *
 * The API is UUID-based: season → category → standings/events. We resolve the
 * current season and the MotoGP category once and cache the assembled snapshot
 * for ten minutes.
 */

const TTL_MS = 10 * 60_000;

const http = axios.create({
  baseURL: env.MOTOGP_API_BASE_URL,
  timeout: 12_000,
  headers: { Accept: 'application/json' },
});

interface PulseSeason {
  id: string;
  year: number;
  current: boolean;
}

interface PulseCategory {
  id: string;
  name: string;
}

interface PulseEvent {
  id: string;
  name: string;
  short_name: string;
  date_start: string;
  date_end: string;
  status: string;
  test: boolean;
  circuit: { name: string; place: string; nation: string };
  country: { iso: string; name: string };
}

interface PulseStandingRow {
  position: number;
  points: number;
  race_wins: number;
  podiums: number;
  rider: { full_name: string; number: number };
  team: { name: string };
  constructor: { name: string };
}

export interface MotoGPRiderStanding {
  position: number;
  code: string;
  riderNumber: number;
  fullName: string;
  teamName: string;
  constructorName: string;
  points: number;
  wins: number;
  podiums: number;
}

export interface MotoGPTeamStanding {
  name: string;
  points: number;
}

export interface MotoGPStandingsResult {
  season: number;
  riders: MotoGPRiderStanding[];
  teams: MotoGPTeamStanding[];
  updatedAt: string;
  source: 'motogp';
}

interface MotoGPSnapshot {
  season: number;
  riders: MotoGPRiderStanding[];
  teams: MotoGPTeamStanding[];
  races: RaceSummary[];
  fetchedAt: number;
}

let cache: MotoGPSnapshot | null = null;
let inflight: Promise<MotoGPSnapshot | null> | null = null;

async function get<T>(path: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await http.get<T>(path);
      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 800);
          timer.unref?.();
        });
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Three-letter timing code, e.g. `Marc Marquez` → `MAR`, `Alex Marquez` → `AMA`. */
function riderCode(fullName: string, used: Set<string>): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const surname = (parts.at(-1) ?? fullName).replace(/[^A-Za-z]/g, '').toUpperCase();
  const firstInitial = (parts[0] ?? '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1);

  const candidates = [
    surname.slice(0, 3),
    `${firstInitial}${surname}`.slice(0, 3),
    `${surname.slice(0, 2)}${firstInitial}`.slice(0, 3),
  ].filter((candidate) => candidate.length === 3);

  for (const candidate of candidates) {
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  // Last resort: suffix with a digit so the UI always has a unique code.
  const base = surname.slice(0, 2) || 'GP';
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base}${suffix}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  return base;
}

function mapRaces(events: PulseEvent[]): RaceSummary[] {
  return events
    .filter((event) => event.test === false)
    .sort((a, b) => a.date_start.localeCompare(b.date_start))
    .map((event, index) => {
      const status: RaceSummary['status'] =
        event.status === 'FINISHED'
          ? 'finished'
          : event.status === 'CURRENT'
            ? 'live'
            : 'upcoming';

      return {
        round: index + 1,
        name: event.name,
        shortName: event.short_name,
        circuit: event.circuit.name,
        locality: event.circuit.place,
        country: event.country.name,
        countryCode: countryCode(event.country.iso),
        startsAt: null,
        date: event.date_start,
        status,
      };
    });
}

async function loadSnapshot(): Promise<MotoGPSnapshot | null> {
  const seasons = await get<PulseSeason[]>('/results/seasons');
  const season = seasons.find((entry) => entry.current) ?? seasons[0];
  if (!season) return null;

  const categories = await get<PulseCategory[]>(`/results/categories?seasonUuid=${season.id}`);
  const category =
    categories.find((entry) => /motogp/i.test(entry.name) && !/moto2|moto3/i.test(entry.name)) ??
    categories[0];
  if (!category) return null;

  const [standings, events] = await Promise.all([
    get<{ classification: PulseStandingRow[] }>(
      `/results/standings?seasonUuid=${season.id}&categoryUuid=${category.id}`,
    ),
    get<PulseEvent[]>(`/results/events?seasonUuid=${season.id}`),
  ]);

  const usedCodes = new Set<string>();
  const riders = (standings.classification ?? [])
    .filter((row) => row.rider && typeof row.position === 'number')
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      position: row.position,
      code: riderCode(row.rider.full_name, usedCodes),
      riderNumber: row.rider.number,
      fullName: row.rider.full_name,
      teamName: row.team?.name ?? row.constructor?.name ?? 'Unknown',
      constructorName: row.constructor?.name ?? row.team?.name ?? 'Unknown',
      points: row.points ?? 0,
      wins: row.race_wins ?? 0,
      podiums: row.podiums ?? 0,
    }));

  const teamPoints = new Map<string, number>();
  for (const rider of riders) {
    teamPoints.set(rider.teamName, (teamPoints.get(rider.teamName) ?? 0) + rider.points);
  }

  const teams = [...teamPoints]
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points);

  return {
    season: season.year,
    riders,
    teams,
    races: mapRaces(events),
    fetchedAt: Date.now(),
  };
}

async function snapshot(): Promise<MotoGPSnapshot | null> {
  if (!env.MOTOGP_API_ENABLED) return null;
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = loadSnapshot()
    .then((result) => {
      if (result) {
        cache = result;
        logger.info('motogp.snapshot_loaded', {
          season: result.season,
          riders: result.riders.length,
          races: result.races.length,
        });
      }
      return result ?? cache;
    })
    .catch((error: unknown) => {
      logger.warn('motogp.snapshot_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Real MotoGP rider + team standings, or `null` when the API is unavailable. */
export async function getMotoGPStandings(): Promise<MotoGPStandingsResult | null> {
  const data = await snapshot();
  if (!data || data.riders.length === 0) return null;

  return {
    season: data.season,
    riders: data.riders,
    teams: data.teams,
    updatedAt: new Date(data.fetchedAt).toISOString(),
    source: 'motogp',
  };
}

/** MotoGP calendar (next + last event) from the same snapshot. */
export async function getMotoGPSchedule(): Promise<ScheduleResult | null> {
  const data = await snapshot();
  if (!data || data.races.length === 0) return null;

  return {
    series: 'MOTOGP',
    season: data.season,
    next: data.races.find((race) => race.status === 'upcoming') ?? null,
    last: [...data.races].reverse().find((race) => race.status !== 'upcoming') ?? null,
    races: data.races,
    updatedAt: new Date(data.fetchedAt).toISOString(),
    source: 'motogp',
  };
}

/** Test/ops hook. */
export function resetMotoGPCache(): void {
  cache = null;
  inflight = null;
}
