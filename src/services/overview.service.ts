import { Series, SessionType } from '@prisma/client';
import { env } from '../config/env';
import { isDatabaseOnline, prisma, safeQuery } from '../config/prisma';
import {
  REFERENCE_CIRCUITS,
  REFERENCE_DRIVERS,
  REFERENCE_SESSIONS,
  referenceIds,
} from '../config/referenceData';
import { SERIES_LABELS, SESSION_TYPE_LABELS } from '../config/series';
import { teamColor } from '../config/teamColors';
import { cacheBackend } from './cache.service';
import { simulateFrame } from './simulation.service';
import { getWeather, type WeatherSnapshot } from './weather.service';
import { clamp, round } from '../utils/random';

export interface LiveSessionDto {
  id: string;
  series: Series;
  seriesLabel: string;
  sessionType: SessionType;
  sessionTypeLabel: string;
  startTime: string;
  isActive: boolean;
  elapsedMinutes: number;
  progressPct: number;
  circuit: {
    id: string;
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    lengthKm: number;
  };
}

export interface LiveDriverDto {
  position: number;
  driverId: string;
  code: string;
  driverNumber: number;
  fullName: string;
  teamName: string;
  teamColor: string;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: boolean;
  lastUpdated: string;
  championshipPosition: number;
  points: number;
}

export interface LiveOverviewResult {
  session: LiveSessionDto | null;
  weather: WeatherSnapshot | null;
  leaderboard: LiveDriverDto[];
  meta: {
    generatedAt: string;
    degraded: boolean;
    databaseOnline: boolean;
    cache: 'redis' | 'memory';
    sampleRateHz: number;
    websocketPath: string;
  };
}

const SESSION_DURATION_MINUTES: Record<Series, Record<SessionType, number>> = {
  F1: { PRACTICE: 60, QUALIFYING: 60, SPRINT: 30, RACE: 90 },
  F2: { PRACTICE: 45, QUALIFYING: 30, SPRINT: 30, RACE: 60 },
  MOTOGP: { PRACTICE: 45, QUALIFYING: 30, SPRINT: 30, RACE: 45 },
};

function buildSession(
  series: Series,
  sessionType: SessionType,
  startTime: Date,
  isActive: boolean,
  circuit: LiveSessionDto['circuit'],
  id: string,
): LiveSessionDto {
  const elapsedMinutes = round(Math.max(0, (Date.now() - startTime.getTime()) / 60_000), 1);
  const duration = SESSION_DURATION_MINUTES[series][sessionType];

  return {
    id,
    series,
    seriesLabel: SERIES_LABELS[series],
    sessionType,
    sessionTypeLabel: SESSION_TYPE_LABELS[sessionType],
    startTime: startTime.toISOString(),
    isActive,
    elapsedMinutes,
    progressPct: clamp(round((elapsedMinutes / duration) * 100, 1), 0, 100),
    circuit,
  };
}

export async function getLiveOverview(seriesFilter?: Series): Promise<LiveOverviewResult> {
  const { data: sessionRecord, degraded: sessionDegraded } = await safeQuery(
    'overview.session',
    async () => {
      const where = seriesFilter ? { series: seriesFilter } : {};
      const active = await prisma.session.findFirst({
        where: { ...where, isActive: true },
        orderBy: { startTime: 'desc' },
        include: { circuit: true },
      });
      const record =
        active ??
        (await prisma.session.findFirst({
          where,
          orderBy: { startTime: 'desc' },
          include: { circuit: true },
        }));

      if (!record) return null;

      return {
        id: record.id,
        series: record.series,
        sessionType: record.sessionType,
        startTime: record.startTime,
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
        REFERENCE_SESSIONS.find(
          (session) => session.isActive && (!seriesFilter || session.series === seriesFilter),
        ) ??
        REFERENCE_SESSIONS.find((session) => !seriesFilter || session.series === seriesFilter);
      if (!reference) return null;

      const circuit =
        REFERENCE_CIRCUITS.find((item) => item.key === reference.circuitKey) ??
        REFERENCE_CIRCUITS[0];

      return {
        id: referenceIds.session(reference.key),
        series: reference.series,
        sessionType: reference.sessionType,
        startTime: new Date(Date.now() + reference.startOffsetMinutes * 60_000),
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

  if (!sessionRecord) {
    return {
      session: null,
      weather: null,
      leaderboard: [],
      meta: {
        generatedAt: new Date().toISOString(),
        degraded: true,
        databaseOnline: isDatabaseOnline(),
        cache: cacheBackend(),
        sampleRateHz: env.wsBroadcastHz,
        websocketPath: env.WS_PATH,
      },
    };
  }

  const session = buildSession(
    sessionRecord.series,
    sessionRecord.sessionType,
    sessionRecord.startTime,
    sessionRecord.isActive,
    sessionRecord.circuit,
    sessionRecord.id,
  );

  const { data: roster, degraded: rosterDegraded } = await safeQuery(
    'overview.roster',
    () =>
      prisma.driver.findMany({
        where: { series: sessionRecord.series },
        orderBy: [{ points: 'desc' }, { code: 'asc' }],
      }),
    () =>
      REFERENCE_DRIVERS.filter((driver) => driver.series === sessionRecord.series).map((driver) => ({
        id: referenceIds.driver(driver.code),
        ...driver,
      })),
  );

  const { data: latestRows, degraded: telemetryDegraded } = await safeQuery(
    'overview.latest_telemetry',
    async () => {
      const grouped = await prisma.telemetry.groupBy({
        by: ['driverId'],
        where: { sessionId: sessionRecord.id },
        _max: { timestamp: true },
      });

      const keys = grouped
        .filter((entry) => entry._max.timestamp !== null)
        .map((entry) => ({ driverId: entry.driverId, timestamp: entry._max.timestamp! }));

      if (keys.length === 0) return [];

      return prisma.telemetry.findMany({
        where: { sessionId: sessionRecord.id, OR: keys },
      });
    },
    () => [],
  );

  const latestByDriver = new Map(latestRows.map((row) => [row.driverId, row]));
  const now = Date.now();

  const leaderboard: LiveDriverDto[] = roster
    .map((driver, championshipIndex) => {
      const row = latestByDriver.get(driver.id);
      const fallback = simulateFrame(driver.code, sessionRecord.series, now);

      return {
        position: 0,
        driverId: driver.id,
        code: driver.code,
        driverNumber: driver.driverNumber,
        fullName: driver.fullName,
        teamName: driver.teamName,
        teamColor: teamColor(driver.teamName),
        speed: row ? round(row.speed, 1) : fallback.speed,
        rpm: row ? row.rpm : fallback.rpm,
        gear: row ? row.gear : fallback.gear,
        throttle: row ? round(row.throttle, 1) : fallback.throttle,
        brake: row ? round(row.brake, 1) : fallback.brake,
        drs: row ? row.drs : fallback.drs,
        lastUpdated: row ? row.timestamp.toISOString() : fallback.timestamp,
        championshipPosition: championshipIndex + 1,
        points: round(driver.points, 1),
      };
    })
    .sort((a, b) => b.speed - a.speed)
    .map((driver, index) => ({ ...driver, position: index + 1 }));

  const weather = await getWeather(
    sessionRecord.circuit.latitude,
    sessionRecord.circuit.longitude,
  ).catch(() => null);

  return {
    session,
    weather,
    leaderboard,
    meta: {
      generatedAt: new Date().toISOString(),
      degraded:
        sessionDegraded ||
        rosterDegraded ||
        telemetryDegraded ||
        leaderboard.some((driver) => !latestByDriver.has(driver.driverId)),
      databaseOnline: isDatabaseOnline(),
      cache: cacheBackend(),
      sampleRateHz: env.wsBroadcastHz,
      websocketPath: env.WS_PATH,
    },
  };
}
