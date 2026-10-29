import { Series, SessionType } from '@prisma/client';
import { SERIES_LABELS, SESSION_TYPE_LABELS } from '../config/series';
import { REFERENCE_CIRCUITS, type ReferenceCircuit } from '../config/referenceData';
import { clamp, round } from '../utils/random';
import {
  getOpenF1Context,
  type OpenF1CarSample,
  type OpenF1Context,
  type OpenF1Driver,
} from './openf1.service';
import type { LiveDriverDto, LiveSessionDto } from './overview.service';
import { compoundFor } from './tyre.service';
import type { WeatherSnapshot } from './weather.service';

/**
 * Turns an OpenF1 session into the shapes this API exposes.
 *
 * When a session is running, samples are read at "now". When the latest
 * session has finished, the last `OPENF1_WINDOW_SECONDS` of real car data are
 * replayed on a loop at the WebSocket broadcast rate, so the dashboard always
 * has genuine telemetry to show.
 */

export interface LiveTelemetryFrame {
  driverId: string;
  code: string;
  driverNumber: number;
  fullName: string;
  teamName: string;
  teamColor: string;
  position: number;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: boolean;
  /** Compound currently fitted, when the session publishes stints. */
  tyre?: {
    compound: string;
    compoundLabel: string;
    colorHex: string;
    textColor: string;
    laps: number;
  };
  timestamp: string;
}

export interface OpenF1Overview {
  session: LiveSessionDto;
  weather: WeatherSnapshot | null;
  leaderboard: LiveDriverDto[];
  mode: 'live' | 'replay';
  sessionKey: number;
  circuitName: string;
}

const SESSION_MINUTES: Record<SessionType, number> = {
  PRACTICE: 60,
  QUALIFYING: 60,
  SPRINT: 30,
  RACE: 90,
};

/** Replay clock: anchored once per upstream refresh, then loops. */
let anchorAt = 0;
let anchorFetchedAt = 0;

function cursorFor(context: OpenF1Context): number {
  if (context.mode === 'live') return Math.min(Date.now(), context.windowEnd);

  if (anchorFetchedAt !== context.fetchedAt) {
    anchorFetchedAt = context.fetchedAt;
    anchorAt = Date.now();
  }

  const span = Math.max(1, context.windowEnd - context.windowStart);
  return context.windowStart + ((Date.now() - anchorAt) % span);
}

/** Last sample at or before `at` (binary search); falls back to the first. */
function sampleAt(samples: OpenF1CarSample[], at: number): OpenF1CarSample | null {
  if (samples.length === 0) return null;

  let low = 0;
  let high = samples.length - 1;
  let match: OpenF1CarSample | null = null;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (samples[mid].t <= at) {
      match = samples[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return match ?? samples[0];
}

export function mapSessionType(raw: string): SessionType {
  const value = raw.toLowerCase();
  if (value.includes('sprint')) return SessionType.SPRINT;
  if (value.includes('qualif') || value.includes('shootout')) return SessionType.QUALIFYING;
  if (value.includes('race')) return SessionType.RACE;
  return SessionType.PRACTICE;
}

function driverId(driver: OpenF1Driver): string {
  return `openf1:driver:${driver.driverNumber}`;
}

function teamColorFor(driver: OpenF1Driver): string {
  return /^#[0-9a-f]{6}$/i.test(driver.teamColour) ? driver.teamColour : '#8C99A5';
}

/** Compound on the car right now, plus the laps run on that set. */
function tyreFor(context: OpenF1Context, driverNumber: number) {
  const current = context.stints.get(driverNumber)?.at(-1);
  if (!current) return undefined;

  const compound = compoundFor(current.compound);
  return {
    compound: compound.code,
    compoundLabel: compound.label,
    colorHex: compound.colorHex,
    textColor: compound.textColor,
    laps: Math.max(0, current.lapEnd - current.lapStart + 1) + current.tyreAgeAtStart,
  };
}

/**
 * OpenF1 only ships a short circuit name, so map the ones we know onto the
 * reference table to recover coordinates and track length for the UI.
 */
const CIRCUIT_ALIASES: Record<string, string> = {
  austin: 'cota',
  'circuit of the americas': 'cota',
  silverstone: 'silverstone',
  monza: 'monza',
  'spa-francorchamps': 'spa',
  'spa-francorchamps, belgium': 'spa',
  barcelona: 'barcelona',
  mugello: 'mugello',
  jerez: 'jerez',
  sakhir: 'bahrain',
  suzuka: 'suzuka',
  interlagos: 'interlagos',
  'são paulo': 'interlagos',
  'sao paulo': 'interlagos',
  lusail: 'losail',
  spielberg: 'redbullring',
  'red bull ring': 'redbullring',
};

function referenceCircuit(shortName: string): ReferenceCircuit | undefined {
  const key = CIRCUIT_ALIASES[shortName.trim().toLowerCase()];
  if (!key) return undefined;
  return REFERENCE_CIRCUITS.find((circuit) => circuit.key === key);
}

export function toSessionDto(context: OpenF1Context): LiveSessionDto {
  const start = Date.parse(context.session.dateStart);
  const end = Date.parse(context.session.dateEnd);
  const now = Date.now();
  const sessionType = mapSessionType(context.session.sessionType || context.session.sessionName);

  const elapsedMinutes = round(clamp((now - start) / 60_000, 0, SESSION_MINUTES[sessionType]), 1);
  const progressPct = round(clamp(((now - start) / Math.max(1, end - start)) * 100, 0, 100), 1);
  const circuit = referenceCircuit(context.session.circuitShortName);

  return {
    id: `openf1:session:${context.session.sessionKey}`,
    series: Series.F1,
    seriesLabel: SERIES_LABELS[Series.F1],
    sessionType,
    sessionTypeLabel: SESSION_TYPE_LABELS[sessionType],
    startTime: new Date(start).toISOString(),
    isActive: context.mode === 'live',
    elapsedMinutes,
    progressPct,
    circuit: {
      id: circuit ? `openf1:circuit:${circuit.key}` : `openf1:circuit:${context.session.circuitShortName}`,
      name: circuit?.name ?? context.session.circuitShortName,
      shortName: circuit?.shortName ?? context.session.circuitShortName,
      country: circuit?.country ?? context.session.countryName,
      latitude: circuit?.latitude ?? 0,
      longitude: circuit?.longitude ?? 0,
      lengthKm: circuit?.lengthKm ?? 0,
    },
  };
}

export function buildFrames(context: OpenF1Context, at: number): LiveTelemetryFrame[] {
  const frames: LiveTelemetryFrame[] = [];

  for (const driver of context.drivers) {
    const samples = context.carData.get(driver.driverNumber);
    if (!samples || samples.length === 0) continue;

    const sample = sampleAt(samples, at);
    if (!sample) continue;

    frames.push({
      driverId: driverId(driver),
      code: driver.code,
      driverNumber: driver.driverNumber,
      fullName: driver.fullName,
      teamName: driver.teamName,
      teamColor: teamColorFor(driver),
      position: context.positions.get(driver.driverNumber) ?? 99,
      speed: round(sample.speed, 1),
      rpm: sample.rpm,
      gear: sample.gear,
      throttle: round(sample.throttle, 1),
      brake: round(sample.brake, 1),
      drs: sample.drs,
      tyre: tyreFor(context, driver.driverNumber),
      timestamp: new Date(sample.t).toISOString(),
    });
  }

  return frames.sort((a, b) => a.position - b.position);
}

/** Frames for the WebSocket feed, or `null` when there is no live session. */
export async function getLiveTelemetryFrames(series: Series): Promise<LiveTelemetryFrame[] | null> {
  if (series !== Series.F1) return null;

  const context = await getOpenF1Context();
  if (!context) return null;

  // Replays of a finished session are historical data, not live telemetry:
  // the dashboard only streams cars while a session is actually running.
  if (context.mode !== 'live') return null;

  const frames = buildFrames(context, cursorFor(context));
  return frames.length > 0 ? frames : null;
}

/** Full overview payload built from OpenF1, or `null` when unavailable. */
export async function getOpenF1Overview(): Promise<OpenF1Overview | null> {
  const context = await getOpenF1Context();
  if (!context) return null;

  const frames = buildFrames(context, cursorFor(context));
  if (frames.length === 0) return null;

  const leaderboard: LiveDriverDto[] = frames.map((frame, index) => {
    const standing = context.championship.get(frame.driverNumber);
    return {
      position: frame.position === 99 ? index + 1 : frame.position,
      driverId: frame.driverId,
      code: frame.code,
      driverNumber: frame.driverNumber,
      fullName: frame.fullName,
      teamName: frame.teamName,
      teamColor: frame.teamColor,
      speed: frame.speed,
      rpm: frame.rpm,
      gear: frame.gear,
      throttle: frame.throttle,
      brake: frame.brake,
      drs: frame.drs,
      tyre: frame.tyre,
      lastUpdated: frame.timestamp,
      championshipPosition: standing?.position ?? index + 1,
      points: round(standing?.points ?? 0, 1),
    };
  });

  return {
    session: toSessionDto(context),
    weather: context.weather,
    leaderboard,
    mode: context.mode,
    sessionKey: context.session.sessionKey,
    circuitName: context.session.circuitShortName,
  };
}

/** Real F1 championship table from OpenF1 (empty when unavailable). */
export async function getOpenF1Championship(): Promise<
  Array<{ driverNumber: number; position: number; points: number }>
> {
  const context = await getOpenF1Context();
  if (!context) return [];

  return context.drivers
    .map((driver) => {
      const standing = context.championship.get(driver.driverNumber);
      if (!standing) return null;
      return {
        driverNumber: driver.driverNumber,
        position: standing.position,
        points: standing.points,
      };
    })
    .filter((entry): entry is { driverNumber: number; position: number; points: number } =>
      Boolean(entry),
    )
    .sort((a, b) => a.position - b.position);
}

/** Driver metadata (name, team, colour) keyed by car number. */
export async function getOpenF1Drivers(): Promise<Map<number, OpenF1Driver>> {
  const context = await getOpenF1Context();
  if (!context) return new Map();
  return new Map(context.drivers.map((driver) => [driver.driverNumber, driver]));
}
