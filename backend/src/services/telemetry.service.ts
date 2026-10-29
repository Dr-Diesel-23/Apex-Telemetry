import { Series } from '@prisma/client';
import { prisma, safeQuery } from '../config/prisma';
import {
  REFERENCE_CIRCUITS,
  REFERENCE_DRIVERS,
  REFERENCE_SESSIONS,
  referenceIds,
} from '../config/referenceData';
import { teamColor } from '../config/teamColors';
import { HttpError } from '../utils/httpError';
import { round } from '../utils/random';
import { simulateFrame } from './simulation.service';

export interface TelemetrySample {
  timestamp: string;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: boolean;
}

export interface ComparedDriver {
  driverId: string;
  code: string;
  driverNumber: number;
  fullName: string;
  teamName: string;
  colorHex: string;
  stats: {
    maxSpeed: number;
    avgSpeed: number;
    minSpeed: number;
    topGear: number;
    drsUsagePct: number;
    fullThrottlePct: number;
    brakingPct: number;
  };
  samples: TelemetrySample[];
}

export interface SessionSummary {
  id: string;
  series: Series;
  sessionType: string;
  startTime: string;
  isActive: boolean;
  circuit: {
    id: string;
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    lengthKm: number;
  };
}

export interface TelemetryComparison {
  series: Series;
  session: SessionSummary | null;
  window: { sampleCount: number; from: string | null; to: string | null; sampleIntervalMs: number };
  drivers: [ComparedDriver, ComparedDriver];
  delta: {
    maxSpeedKph: number;
    avgSpeedKph: number;
    fasterDriver: string;
  };
  degraded: boolean;
  generatedAt: string;
}

const DEFAULT_SAMPLE_LIMIT = 120;
const MAX_SAMPLE_LIMIT = 600;

function summarize(driverId: string, code: string, fullName: string, teamName: string, driverNumber: number, samples: TelemetrySample[]): ComparedDriver {
  const speeds = samples.map((sample) => sample.speed);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const minSpeed = speeds.length ? Math.min(...speeds) : 0;
  const avgSpeed = speeds.length ? speeds.reduce((total, value) => total + value, 0) / speeds.length : 0;
  const topGear = samples.reduce((best, sample) => Math.max(best, sample.gear), 0);
  const drsUsagePct = samples.length
    ? (samples.filter((sample) => sample.drs).length / samples.length) * 100
    : 0;
  const fullThrottlePct = samples.length
    ? (samples.filter((sample) => sample.throttle >= 95).length / samples.length) * 100
    : 0;
  const brakingPct = samples.length
    ? (samples.filter((sample) => sample.brake > 5).length / samples.length) * 100
    : 0;

  return {
    driverId,
    code,
    driverNumber,
    fullName,
    teamName,
    colorHex: teamColor(teamName),
    stats: {
      maxSpeed: round(maxSpeed, 1),
      avgSpeed: round(avgSpeed, 1),
      minSpeed: round(minSpeed, 1),
      topGear,
      drsUsagePct: round(drsUsagePct, 1),
      fullThrottlePct: round(fullThrottlePct, 1),
      brakingPct: round(brakingPct, 1),
    },
    samples,
  };
}

function syntheticSamples(code: string, series: Series, limit: number, intervalMs = 500): TelemetrySample[] {
  const now = Date.now();
  return Array.from({ length: limit }, (_, index) => {
    const at = now - (limit - 1 - index) * intervalMs;
    const frame = simulateFrame(code, series, at);
    return {
      timestamp: frame.timestamp,
      speed: frame.speed,
      rpm: frame.rpm,
      gear: frame.gear,
      throttle: frame.throttle,
      brake: frame.brake,
      drs: frame.drs,
    };
  });
}

async function resolveSession(series: Series, sessionId?: string): Promise<{ session: SessionSummary; degraded: boolean }> {
  if (sessionId) {
    const found = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { circuit: true },
    });

    if (!found) {
      throw HttpError.notFound(`Session '${sessionId}' does not exist.`);
    }
    if (found.series !== series) {
      throw HttpError.badRequest(
        `Session '${sessionId}' belongs to ${found.series}, not ${series}.`,
      );
    }
    return {
      degraded: false,
      session: {
        id: found.id,
        series: found.series,
        sessionType: found.sessionType,
        startTime: found.startTime.toISOString(),
        isActive: found.isActive,
        circuit: {
          id: found.circuit.id,
          name: found.circuit.name,
          country: found.circuit.country,
          latitude: found.circuit.latitude,
          longitude: found.circuit.longitude,
          lengthKm: found.circuit.lengthKm,
        },
      },
    };
  }

  const { data, degraded } = await safeQuery<SessionSummary | null>(
    'telemetry.resolve_session',
    async () => {
      const active = await prisma.session.findFirst({
        where: { series, isActive: true },
        orderBy: { startTime: 'desc' },
        include: { circuit: true },
      });
      const record =
        active ??
        (await prisma.session.findFirst({
          where: { series },
          orderBy: { startTime: 'desc' },
          include: { circuit: true },
        }));

      if (!record) return null;

      return {
        id: record.id,
        series: record.series,
        sessionType: record.sessionType,
        startTime: record.startTime.toISOString(),
        isActive: record.isActive,
        circuit: {
          id: record.circuit.id,
          name: record.circuit.name,
          country: record.circuit.country,
          latitude: record.circuit.latitude,
          longitude: record.circuit.longitude,
          lengthKm: record.circuit.lengthKm,
        },
      };
    },
    () => {
      const reference =
        REFERENCE_SESSIONS.find((session) => session.series === series && session.isActive) ??
        REFERENCE_SESSIONS.find((session) => session.series === series);
      if (!reference) return null;

      const circuit =
        REFERENCE_CIRCUITS.find((item) => item.key === reference.circuitKey) ??
        REFERENCE_CIRCUITS[0];

      return {
        id: referenceIds.session(reference.key),
        series,
        sessionType: reference.sessionType,
        startTime: new Date(
          Date.now() + reference.startOffsetMinutes * 60_000,
        ).toISOString(),
        isActive: reference.isActive,
        circuit: {
          id: referenceIds.circuit(circuit.key),
          name: circuit.name,
          country: circuit.country,
          latitude: circuit.latitude,
          longitude: circuit.longitude,
          lengthKm: circuit.lengthKm,
        },
      };
    },
  );

  if (!data) {
    // No session at all for this series — synthesise one so the UI still works.
    const reference = REFERENCE_SESSIONS.find((session) => session.series === series);
    const circuit =
      REFERENCE_CIRCUITS.find((item) => item.key === reference?.circuitKey) ??
      REFERENCE_CIRCUITS[0];

    return {
      degraded: true,
      session: {
        id: referenceIds.session(reference?.key ?? `${series}-synthetic`),
        series,
        sessionType: reference?.sessionType ?? 'RACE',
        startTime: new Date(Date.now() - 20 * 60_000).toISOString(),
        isActive: true,
        circuit: {
          id: referenceIds.circuit(circuit.key),
          name: circuit.name,
          country: circuit.country,
          latitude: circuit.latitude,
          longitude: circuit.longitude,
          lengthKm: circuit.lengthKm,
        },
      },
    };
  }

  return { degraded, session: data };
}

export async function compareDrivers(
  series: Series,
  code1: string,
  code2: string,
  sessionId?: string,
  limit = DEFAULT_SAMPLE_LIMIT,
): Promise<TelemetryComparison> {
  const first = code1.trim().toUpperCase();
  const second = code2.trim().toUpperCase();

  if (!first || !second) {
    throw HttpError.badRequest('Both driver1 and driver2 query parameters are required.');
  }
  if (first === second) {
    throw HttpError.badRequest('driver1 and driver2 must reference two different drivers.');
  }
  if (!Number.isFinite(limit) || limit < 2 || limit > MAX_SAMPLE_LIMIT) {
    throw HttpError.badRequest(`limit must be between 2 and ${MAX_SAMPLE_LIMIT}.`);
  }

  const { data: drivers, degraded: driversDegraded } = await safeQuery(
    'telemetry.drivers',
    () => prisma.driver.findMany({ where: { series } }),
    () =>
      REFERENCE_DRIVERS.filter((driver) => driver.series === series).map((driver) => ({
        id: referenceIds.driver(driver.code),
        ...driver,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
  );

  const missing = [first, second].filter((code) => !drivers.some((driver) => driver.code === code));
  if (missing.length > 0) {
    throw HttpError.notFound(
      `Unknown ${series} driver code(s): ${missing.join(', ')}.`,
      { availableDrivers: drivers.map((driver) => driver.code) },
    );
  }

  const driverA = drivers.find((driver) => driver.code === first)!;
  const driverB = drivers.find((driver) => driver.code === second)!;

  const { session, degraded: sessionDegraded } = await resolveSession(series, sessionId);

  const { data: rows, degraded: telemetryDegraded } = await safeQuery(
    'telemetry.compare',
    async () => {
      const [a, b] = await Promise.all(
        [driverA, driverB].map((driver) =>
          prisma.telemetry.findMany({
            where: { sessionId: session.id, driverId: driver.id },
            orderBy: { timestamp: 'desc' },
            take: limit,
          }),
        ),
      );
      return { a: a.reverse(), b: b.reverse() };
    },
    () => ({
      a: syntheticSamples(first, series, limit).map((sample, index) => ({
        id: index + 1,
        sessionId: session.id,
        driverId: driverA.id,
        ...sample,
        timestamp: new Date(sample.timestamp),
      })),
      b: syntheticSamples(second, series, limit).map((sample, index) => ({
        id: index + 1,
        sessionId: session.id,
        driverId: driverB.id,
        ...sample,
        timestamp: new Date(sample.timestamp),
      })),
    }),
  );

  const toSamples = (list: typeof rows.a): TelemetrySample[] =>
    list.map((row) => ({
      timestamp: row.timestamp.toISOString(),
      speed: round(row.speed, 1),
      rpm: row.rpm,
      gear: row.gear,
      throttle: round(row.throttle, 1),
      brake: round(row.brake, 1),
      drs: row.drs,
    }));

  let samplesA = toSamples(rows.a);
  let samplesB = toSamples(rows.b);
  let degraded = driversDegraded || sessionDegraded || telemetryDegraded;
  if (samplesA.length === 0 || samplesB.length === 0) {
    // Session exists but has no stored laps for these drivers yet.
    samplesA = syntheticSamples(first, series, limit);
    samplesB = syntheticSamples(second, series, limit);
    degraded = true;
  }

  const comparedA = summarize(driverA.id, driverA.code, driverA.fullName, driverA.teamName, driverA.driverNumber, samplesA);
  const comparedB = summarize(driverB.id, driverB.code, driverB.fullName, driverB.teamName, driverB.driverNumber, samplesB);

  const maxSpeedDelta = round(comparedA.stats.maxSpeed - comparedB.stats.maxSpeed, 1);
  const avgSpeedDelta = round(comparedA.stats.avgSpeed - comparedB.stats.avgSpeed, 1);
  const timestamps = [...samplesA, ...samplesB].map((sample) => sample.timestamp).sort();

  const intervalMs =
    samplesA.length > 1
      ? Math.round(
          (new Date(samplesA[samplesA.length - 1].timestamp).getTime() -
            new Date(samplesA[0].timestamp).getTime()) /
            (samplesA.length - 1),
        )
      : 0;

  return {
    series,
    session,
    window: {
      sampleCount: Math.min(samplesA.length, samplesB.length),
      from: timestamps[0] ?? null,
      to: timestamps[timestamps.length - 1] ?? null,
      sampleIntervalMs: intervalMs,
    },
    drivers: [comparedA, comparedB],
    delta: {
      maxSpeedKph: Math.abs(maxSpeedDelta),
      avgSpeedKph: Math.abs(avgSpeedDelta),
      fasterDriver: maxSpeedDelta >= 0 ? comparedA.code : comparedB.code,
    },
    degraded,
    generatedAt: new Date().toISOString(),
  };
}
