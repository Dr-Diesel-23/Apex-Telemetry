import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { WeatherSnapshot } from './weather.service';

/**
 * OpenF1 (https://api.openf1.org/v1) client.
 *
 * Free tier is rate-limited, so every upstream call goes through a small
 * p-queue and the assembled session context is cached in memory:
 *   - a session that is currently running refreshes every ~30 s,
 *   - a finished session (replay mode) is cached for 10 minutes.
 *
 * Every failure is non-fatal: callers fall back to the database/simulation.
 */

export interface OpenF1Session {
  sessionKey: number;
  meetingKey: number;
  sessionName: string;
  sessionType: string;
  dateStart: string;
  dateEnd: string;
  circuitShortName: string;
  countryName: string;
  location: string;
  year: number;
  isLive: boolean;
}

export interface OpenF1Driver {
  driverNumber: number;
  code: string;
  fullName: string;
  firstName: string;
  lastName: string;
  teamName: string;
  teamColour: string;
}

export interface OpenF1CarSample {
  /** Epoch milliseconds. */
  t: number;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: boolean;
}

export interface OpenF1Stint {
  stintNumber: number;
  /** SOFT / MEDIUM / HARD / INTERMEDIATE / WET (uppercase). */
  compound: string;
  lapStart: number;
  lapEnd: number;
  /** Laps already on the tyre when the stint began (scrubbed sets, etc.). */
  tyreAgeAtStart: number;
}

export interface OpenF1PitStop {
  lapNumber: number;
  /** Time spent in the pit lane, seconds. */
  pitDuration: number | null;
  date: string;
}

export interface OpenF1Standing {
  position: number;
  points: number;
}

export interface OpenF1TeamStanding extends OpenF1Standing {
  teamName: string;
}

export interface OpenF1Context {
  session: OpenF1Session;
  drivers: OpenF1Driver[];
  /** Race position by driver number (latest known). */
  positions: Map<number, number>;
  /** Championship position + points by driver number. */
  championship: Map<number, OpenF1Standing>;
  /** Constructor championship, keyed by team name. */
  teams: Map<string, OpenF1TeamStanding>;
  weather: WeatherSnapshot | null;
  /** Car telemetry by driver number, sorted by time. */
  carData: Map<number, OpenF1CarSample[]>;
  /** Tyre stints by driver number, ordered by stint number. */
  stints: Map<number, OpenF1Stint[]>;
  /** Pit stops by driver number, ordered by lap. */
  pitStops: Map<number, OpenF1PitStop[]>;
  /** Race distance in laps (0 when the session has no stints). */
  totalLaps: number;
  windowStart: number;
  windowEnd: number;
  mode: 'live' | 'replay';
  fetchedAt: number;
}

interface RawSession {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  circuit_short_name: string;
  country_name: string;
  location: string;
  year: number;
}

interface RawDriver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  first_name: string;
  last_name: string;
  team_name: string;
  team_colour: string;
}

interface RawPosition {
  date: string;
  driver_number: number;
  position: number;
}

interface RawChampionship {
  driver_number: number;
  position_current: number;
  points_current: number;
}

interface RawChampionshipTeam {
  team_name: string;
  position_current: number;
  points_current: number;
}

interface RawWeather {
  date: string;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  wind_speed: number;
  rainfall: number;
  pressure: number;
}

interface RawCarData {
  date: string;
  driver_number: number;
  speed: number | null;
  rpm: number | null;
  n_gear: number | null;
  throttle: number | null;
  brake: number | null;
  drs: number | null;
}

interface RawSessionResult {
  driver_number: number;
  position: number | null;
}

interface RawStint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: string | null;
  tyre_age_at_start: number | null;
}

interface RawPit {
  date: string;
  driver_number: number;
  lap_number: number;
  pit_duration: number | null;
  lane_duration: number | null;
  stop_duration: number | null;
}

const LIVE_TTL_MS = 30_000;
const REPLAY_TTL_MS = 10 * 60_000;
const FAILURE_COOLDOWN_MS = 60_000;

const http = axios.create({
  baseURL: env.OPENF1_BASE_URL,
  timeout: env.OPENF1_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

interface OutboundQueue {
  add<T>(task: () => Promise<T>): Promise<T | void>;
}

/**
 * Two lanes share the upstream rate limit:
 *   - `live` feeds the dashboard and must never wait behind a bulk scan,
 *   - `scan` walks historical sessions slowly so it can't starve the live lane.
 */
let liveQueuePromise: Promise<OutboundQueue> | null = null;
let scanQueuePromise: Promise<OutboundQueue> | null = null;

function openF1Queue(lane: 'live' | 'scan' = 'live'): Promise<OutboundQueue> {
  if (lane === 'scan') {
    // The free tier allows ~30 requests/minute in total, so the historical
    // scan trickles at ~17/min and leaves headroom for the dashboard.
    scanQueuePromise ??= import('p-queue').then(
      ({ default: PQueue }) => new PQueue({ concurrency: 1, interval: 3_500, intervalCap: 1 }),
    );
    return scanQueuePromise;
  }

  // One request at a time, ~2.5/s. The free tier returns 429 when a burst of
  // six parallel calls arrives, which used to leave panels silently empty.
  liveQueuePromise ??= import('p-queue').then(
    ({ default: PQueue }) => new PQueue({ concurrency: 1, interval: 400, intervalCap: 1 }),
  );
  return liveQueuePromise;
}

/**
 * OpenF1 filters use operators in the *key* (`date>=2026-…`). Axios' default
 * serializer appends its own `=`, producing `date%3E%3D=2026-…` which the API
 * rejects, so the query string is assembled here instead.
 */
function buildQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => {
      const encoded = encodeURIComponent(String(value));
      return /[<>]=?$/.test(key) ? `${key}${encoded}` : `${encodeURIComponent(key)}=${encoded}`;
    })
    .join('&');
}

const MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

/** 429s and transient 5xx/network errors are worth retrying; 404s are not. */
function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status === undefined) return true;
  return status === 429 || status >= 500;
}

function retryDelayMs(error: unknown, attempt: number): number {
  const header = axios.isAxiosError(error)
    ? (error.response?.headers?.['retry-after'] as string | number | undefined)
    : undefined;
  const retryAfter = Number(header);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1_000, 20_000);
  }
  return Math.min(1_000 * 2 ** attempt, 8_000);
}

async function get<T>(
  path: string,
  params: Record<string, string | number>,
  lane: 'live' | 'scan' = 'live',
): Promise<T[]> {
  const queue = await openF1Queue(lane);
  const url = `${path}?${buildQuery(params)}`;

  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await queue.add(async () =>
        http.get<T[]>(url).then((response) => response.data),
      );
      return Array.isArray(result) ? result : [];
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS - 1 || !isRetryable(error)) throw error;

      const delay = retryDelayMs(error, attempt);
      logger.warn('openf1.retry', {
        path,
        lane,
        attempt: attempt + 1,
        delayMs: delay,
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
      });
      await sleep(delay);
    }
  }
}

function secondsFrom(date: string): number {
  return Date.parse(date);
}

function toCarSamples(rows: RawCarData[]): Map<number, OpenF1CarSample[]> {
  const byDriver = new Map<number, OpenF1CarSample[]>();

  for (const row of rows) {
    if (row.speed === null || row.n_gear === null) continue;

    const t = Date.parse(row.date);
    if (!Number.isFinite(t)) continue;

    const sample: OpenF1CarSample = {
      t,
      speed: Math.max(0, row.speed),
      rpm: row.rpm ?? 0,
      gear: row.n_gear,
      // OpenF1 occasionally reports sensor overshoot (e.g. 104%).
      throttle: Math.min(100, Math.max(0, row.throttle ?? 0)),
      brake: Math.min(100, Math.max(0, row.brake ?? 0)),
      drs: Boolean(row.drs),
    };

    const bucket = byDriver.get(row.driver_number);
    if (bucket) bucket.push(sample);
    else byDriver.set(row.driver_number, [sample]);
  }

  for (const samples of byDriver.values()) {
    samples.sort((a, b) => a.t - b.t);
  }

  return byDriver;
}

function toStints(rows: RawStint[]): Map<number, OpenF1Stint[]> {
  const byDriver = new Map<number, OpenF1Stint[]>();

  for (const row of rows) {
    if (!row.compound) continue;
    const stint: OpenF1Stint = {
      stintNumber: row.stint_number,
      compound: row.compound.toUpperCase(),
      lapStart: row.lap_start,
      lapEnd: row.lap_end,
      tyreAgeAtStart: row.tyre_age_at_start ?? 0,
    };

    const bucket = byDriver.get(row.driver_number);
    if (bucket) bucket.push(stint);
    else byDriver.set(row.driver_number, [stint]);
  }

  for (const list of byDriver.values()) {
    list.sort((a, b) => a.stintNumber - b.stintNumber);
  }

  return byDriver;
}

function toPitStops(rows: RawPit[]): Map<number, OpenF1PitStop[]> {
  const byDriver = new Map<number, OpenF1PitStop[]>();

  for (const row of rows) {
    const stop: OpenF1PitStop = {
      lapNumber: row.lap_number,
      pitDuration: row.pit_duration ?? row.lane_duration ?? row.stop_duration ?? null,
      date: row.date,
    };

    const bucket = byDriver.get(row.driver_number);
    if (bucket) bucket.push(stop);
    else byDriver.set(row.driver_number, [stop]);
  }

  for (const list of byDriver.values()) {
    list.sort((a, b) => a.lapNumber - b.lapNumber);
  }

  return byDriver;
}

function latestPositions(rows: RawPosition[]): Map<number, number> {
  const latest = new Map<number, { t: number; position: number }>();

  for (const row of rows) {
    const t = Date.parse(row.date);
    if (!Number.isFinite(t)) continue;
    const current = latest.get(row.driver_number);
    if (!current || t >= current.t) {
      latest.set(row.driver_number, { t, position: row.position });
    }
  }

  return new Map([...latest].map(([driverNumber, value]) => [driverNumber, value.position]));
}

function latestWeather(rows: RawWeather[]): WeatherSnapshot | null {
  if (rows.length === 0) return null;

  const row = [...rows].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).at(-1);
  if (!row) return null;

  const raining = row.rainfall > 0;

  return {
    source: 'openf1',
    fetchedAt: new Date().toISOString(),
    airTempC: row.air_temperature,
    trackTempC: row.track_temperature,
    rainProbability: raining ? 100 : 0,
    humidity: Math.round(row.humidity),
    // OpenF1 reports wind in m/s.
    windSpeedKph: Math.round(row.wind_speed * 3.6 * 10) / 10,
    precipitationMm: row.rainfall,
    isRaining: raining,
    condition: raining ? 'Rain' : 'Dry',
    conditionCode: raining ? 61 : 0,
    nextHours: [],
  };
}

function mapSession(raw: RawSession): OpenF1Session {
  const start = Date.parse(raw.date_start);
  const end = Date.parse(raw.date_end);
  const now = Date.now();

  return {
    sessionKey: raw.session_key,
    meetingKey: raw.meeting_key,
    sessionName: raw.session_name,
    sessionType: raw.session_type,
    dateStart: raw.date_start,
    dateEnd: raw.date_end,
    circuitShortName: raw.circuit_short_name,
    countryName: raw.country_name,
    location: raw.location,
    year: raw.year,
    isLive: now >= start && now <= end,
  };
}

let contextCache: OpenF1Context | null = null;
let contextAt = 0;
let inflight: Promise<OpenF1Context | null> | null = null;
let lastFailureAt = 0;

async function loadContext(): Promise<OpenF1Context | null> {
  const sessions = await get<RawSession>('/sessions', { session_key: 'latest' });
  const rawSession = sessions.at(-1);
  if (!rawSession) return null;

  const session = mapSession(rawSession);
  const sessionKey = session.sessionKey;

  const [drivers, positions, championship, teams, weather, stints, pitStops] =
    await Promise.allSettled([
      get<RawDriver>('/drivers', { session_key: sessionKey }),
      get<RawPosition>('/position', { session_key: sessionKey }),
      get<RawChampionship>('/championship_drivers', { session_key: sessionKey }),
      get<RawChampionshipTeam>('/championship_teams', { session_key: sessionKey }),
      get<RawWeather>('/weather', { session_key: sessionKey }),
      get<RawStint>('/stints', { session_key: sessionKey }),
      get<RawPit>('/pit', { session_key: sessionKey }),
    ]);

  // A single upstream hiccup should degrade one panel, not the whole payload,
  // so each failure is logged rather than thrown.
  const sources = { drivers, positions, championship, teams, weather, stints, pitStops } as const;
  for (const [name, result] of Object.entries(sources)) {
    if (result.status === 'rejected') {
      logger.warn('openf1.endpoint_failed', {
        endpoint: name,
        sessionKey,
        message:
          result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  if (drivers.status !== 'fulfilled' || drivers.value.length === 0) {
    throw new Error('OpenF1 returned no drivers for the latest session');
  }

  /**
   * A finished session's `date_end` is the scheduled end, which is often well
   * after the last car crossed the line. Anchor the replay window on the last
   * *position* update (the last moment the timing tower changed) so we replay
   * racing laps rather than cars parked in parc fermé.
   */
  const lastPosition =
    positions.status === 'fulfilled'
      ? positions.value.map((row) => row.date).sort().at(-1)
      : undefined;

  const observedEnd = lastPosition ? Date.parse(lastPosition) : 0;

  const end = session.isLive
    ? Date.now()
    : observedEnd || Date.parse(session.dateEnd);

  const windowStart = end - env.OPENF1_WINDOW_SECONDS * 1_000;

  const carData = await get<RawCarData>('/car_data', {
    session_key: sessionKey,
    'date>=': new Date(windowStart).toISOString(),
    'date<=': new Date(end).toISOString(),
  }).then(
    (rows) => ({ status: 'fulfilled' as const, value: rows }),
    (error: unknown) => ({ status: 'rejected' as const, reason: error }),
  );

  const roster: OpenF1Driver[] = drivers.value.map((driver) => ({
    driverNumber: driver.driver_number,
    code: driver.name_acronym,
    fullName: driver.full_name,
    firstName: driver.first_name,
    lastName: driver.last_name,
    teamName: driver.team_name,
    teamColour: driver.team_colour ? `#${driver.team_colour.replace('#', '')}` : '#8C99A5',
  }));

  const samples = carData.status === 'fulfilled' ? toCarSamples(carData.value) : new Map();
  const usable = new Map(
    [...samples].filter(([driverNumber]) =>
      roster.some((driver) => driver.driverNumber === driverNumber),
    ),
  );

  if (usable.size === 0) {
    throw new Error('OpenF1 returned no car telemetry for the latest session');
  }

  // If one endpoint failed (usually a 429 that outlived the retries), reuse the
  // previous session's copy of that panel instead of blanking it out.
  const previous = contextCache?.session.sessionKey === sessionKey ? contextCache : null;

  const championshipTable =
    championship.status === 'fulfilled'
      ? new Map(
          championship.value.map((row) => [
            row.driver_number,
            { position: row.position_current, points: row.points_current },
          ]),
        )
      : (previous?.championship ?? new Map());

  const teamTable =
    teams.status === 'fulfilled'
      ? new Map(
          teams.value.map((row) => [
            row.team_name,
            {
              teamName: row.team_name,
              position: row.position_current,
              points: row.points_current,
            },
          ]),
        )
      : (previous?.teams ?? new Map());

  const weatherSnapshot =
    weather.status === 'fulfilled'
      ? latestWeather(weather.value)
      : (previous?.weather ?? null);

  const stintTable: Map<number, OpenF1Stint[]> =
    stints.status === 'fulfilled' ? toStints(stints.value) : (previous?.stints ?? new Map());

  const pitStopTable: Map<number, OpenF1PitStop[]> =
    pitStops.status === 'fulfilled'
      ? toPitStops(pitStops.value)
      : (previous?.pitStops ?? new Map());

  const totalLaps = [...stintTable.values()].reduce(
    (max, list) => list.reduce((inner, stint) => Math.max(inner, stint.lapEnd), max),
    0,
  );

  return {
    session,
    drivers: roster,
    positions:
      positions.status === 'fulfilled' ? latestPositions(positions.value) : new Map(),
    championship: championshipTable,
    teams: teamTable,
    weather: weatherSnapshot,
    carData: usable,
    stints: stintTable,
    pitStops: pitStopTable,
    totalLaps,
    windowStart,
    windowEnd: end,
    mode: session.isLive ? 'live' : 'replay',
    fetchedAt: Date.now(),
  };
}

/**
 * Latest OpenF1 session, cached. Returns `null` when the integration is
 * disabled, the API is unreachable, or no session data is available.
 */
export async function getOpenF1Context(force = false): Promise<OpenF1Context | null> {
  if (!env.OPENF1_ENABLED) return null;

  const ttl = contextCache?.mode === 'live' ? LIVE_TTL_MS : REPLAY_TTL_MS;

  if (!force && contextCache && Date.now() - contextAt < ttl) return contextCache;
  if (!force && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) return contextCache;
  if (inflight) return inflight;

  inflight = loadContext()
    .then((context) => {
      if (context) {
        contextCache = context;
        contextAt = Date.now();
        logger.info('openf1.context_loaded', {
          sessionKey: context.session.sessionKey,
          circuit: context.session.circuitShortName,
          mode: context.mode,
          drivers: context.drivers.length,
          samples: [...context.carData.values()].reduce((total, list) => total + list.length, 0),
        });
        // Wins/podiums are not in the championship feed; derive them in the
        // background so the first standings request is already warm.
        warmOpenF1SeasonStats();
      }
      return context;
    })
    .catch((error: unknown) => {
      lastFailureAt = Date.now();
      logger.warn('openf1.context_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return contextCache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Real constructor championship from OpenF1 (empty when unavailable). */
export async function getOpenF1TeamStandings(): Promise<OpenF1TeamStanding[]> {
  const context = await getOpenF1Context();
  if (!context) return [];
  return [...context.teams.values()].sort((a, b) => a.position - b.position);
}

/* ── Season wins / podiums ──────────────────────────────────────────────────
 * OpenF1's championship feed only carries points and position. Wins and
 * podiums are derived from every completed race of the season and cached for
 * ten minutes; the scan runs in the background so it never delays a request.
 */
export interface OpenF1SeasonStats {
  wins: Map<number, number>;
  podiums: Map<number, number>;
  races: number;
  updatedAt: number;
}

const SEASON_TTL_MS = 6 * 60 * 60_000;
let seasonStats: OpenF1SeasonStats | null = null;
let seasonInflight: Promise<OpenF1SeasonStats | null> | null = null;

async function loadSeasonStats(session: OpenF1Session): Promise<OpenF1SeasonStats> {
  const sessions = await get<RawSession>(
    '/sessions',
    { year: session.year, session_type: 'Race' },
    'scan',
  );

  const completed = sessions
    .filter((row) => Date.parse(row.date_start) <= Date.now())
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));

  const wins = new Map<number, number>();
  const podiums = new Map<number, number>();
  let races = 0;

  for (const row of completed) {
    try {
      const results = await get<RawSessionResult>(
        '/session_result',
        { session_key: row.session_key },
        'scan',
      );
      if (results.length === 0) continue;
      races += 1;

      for (const result of results) {
        if (typeof result.position !== 'number') continue;
        if (result.position === 1) {
          wins.set(result.driver_number, (wins.get(result.driver_number) ?? 0) + 1);
        }
        if (result.position <= 3) {
          podiums.set(result.driver_number, (podiums.get(result.driver_number) ?? 0) + 1);
        }
      }
    } catch (error) {
      // A race with no published result yet answers 404 — not worth a warning.
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status !== 404) {
        logger.warn('openf1.season_result_failed', {
          sessionKey: row.session_key,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { wins, podiums, races, updatedAt: Date.now() };
}

/** Cached season totals, or `null` while the background scan is still running. */
export function getOpenF1SeasonStats(): OpenF1SeasonStats | null {
  if (!seasonStats) return null;
  return Date.now() - seasonStats.updatedAt < SEASON_TTL_MS ? seasonStats : null;
}

/** Kick off (or refresh) the season scan without blocking the caller. */
export function warmOpenF1SeasonStats(): void {
  if (!env.OPENF1_ENABLED || seasonInflight) return;
  if (getOpenF1SeasonStats()) return;

  const session = contextCache?.session;
  if (!session) return;

  seasonInflight = loadSeasonStats(session)
    .then((stats) => {
      seasonStats = stats;
      logger.info('openf1.season_stats_loaded', { races: stats.races });
      return stats;
    })
    .catch((error: unknown) => {
      logger.warn('openf1.season_stats_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    })
    .finally(() => {
      seasonInflight = null;
    });
}

/** Test/ops hook: forget every cached upstream response. */
export function resetOpenF1Cache(): void {
  contextCache = null;
  contextAt = 0;
  lastFailureAt = 0;
  inflight = null;
  seasonStats = null;
  seasonInflight = null;
}

/** Milliseconds since epoch for an OpenF1 timestamp (exported for tests). */
export function openF1Timestamp(date: string): number {
  return secondsFrom(date);
}
