import { Series } from '@prisma/client';
import { prisma, safeQuery } from '../config/prisma';
import { REFERENCE_CONSTRUCTORS, REFERENCE_DRIVERS, referenceIds } from '../config/referenceData';
import { round } from '../utils/random';

export interface DriverStanding {
  position: number;
  driverId: string;
  code: string;
  driverNumber: number;
  fullName: string;
  teamName: string;
  series: Series;
  points: number;
  wins: number;
  podiums: number;
  gapToLeader: number;
  gapToNext: number;
  pointsSharePct: number;
}

export interface ConstructorStanding {
  position: number;
  constructorId: string;
  name: string;
  series: Series;
  points: number;
  colorHex: string;
  gapToLeader: number;
  gapToNext: number;
  pointsSharePct: number;
}

export interface StandingsResult<T> {
  series: Series;
  updatedAt: string;
  count: number;
  leaderPoints: number;
  standings: T[];
  degraded: boolean;
}

function buildDriverStandings(rows: Array<Omit<DriverStanding, 'position' | 'gapToLeader' | 'gapToNext' | 'pointsSharePct'>>): DriverStanding[] {
  const leaderPoints = rows[0]?.points ?? 0;
  return rows.map((row, index) => ({
    ...row,
    position: index + 1,
    gapToLeader: round(Math.max(0, leaderPoints - row.points), 1),
    gapToNext: index === 0 ? 0 : round(Math.max(0, rows[index - 1].points - row.points), 1),
    pointsSharePct: leaderPoints > 0 ? round((row.points / leaderPoints) * 100, 1) : 0,
  }));
}

function buildConstructorStandings(rows: Array<Omit<ConstructorStanding, 'position' | 'gapToLeader' | 'gapToNext' | 'pointsSharePct'>>): ConstructorStanding[] {
  const leaderPoints = rows[0]?.points ?? 0;
  return rows.map((row, index) => ({
    ...row,
    position: index + 1,
    gapToLeader: round(Math.max(0, leaderPoints - row.points), 1),
    gapToNext: index === 0 ? 0 : round(Math.max(0, rows[index - 1].points - row.points), 1),
    pointsSharePct: leaderPoints > 0 ? round((row.points / leaderPoints) * 100, 1) : 0,
  }));
}

export async function getDriverStandings(series: Series): Promise<StandingsResult<DriverStanding>> {
  const { data, degraded } = await safeQuery(
    'standings.drivers',
    () =>
      prisma.driver.findMany({
        where: { series },
        orderBy: [{ points: 'desc' }, { wins: 'desc' }, { podiums: 'desc' }, { code: 'asc' }],
      }),
    () =>
      REFERENCE_DRIVERS.filter((driver) => driver.series === series).map((driver) => ({
        id: referenceIds.driver(driver.code),
        ...driver,
      })),
  );

  const standings = buildDriverStandings(
    data.map((driver) => ({
      driverId: driver.id,
      code: driver.code,
      driverNumber: driver.driverNumber,
      fullName: driver.fullName,
      teamName: driver.teamName,
      series: driver.series,
      points: round(driver.points, 1),
      wins: driver.wins,
      podiums: driver.podiums,
    })),
  );

  return {
    series,
    updatedAt: new Date().toISOString(),
    count: standings.length,
    leaderPoints: standings[0]?.points ?? 0,
    standings,
    degraded,
  };
}

export async function getConstructorStandings(series: Series): Promise<StandingsResult<ConstructorStanding>> {
  const { data, degraded } = await safeQuery(
    'standings.constructors',
    () =>
      prisma.constructor.findMany({
        where: { series },
        orderBy: [{ points: 'desc' }, { name: 'asc' }],
      }),
    () =>
      REFERENCE_CONSTRUCTORS.filter((constructor) => constructor.series === series).map((constructor) => ({
        id: referenceIds.constructor(constructor.name),
        ...constructor,
      })),
  );

  const standings = buildConstructorStandings(
    data.map((constructor) => ({
      constructorId: constructor.id,
      name: constructor.name,
      series: constructor.series,
      points: round(constructor.points, 1),
      colorHex: constructor.colorHex,
    })),
  );

  return {
    series,
    updatedAt: new Date().toISOString(),
    count: standings.length,
    leaderPoints: standings[0]?.points ?? 0,
    standings,
    degraded,
  };
}
