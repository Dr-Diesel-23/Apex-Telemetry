import { Series } from '@prisma/client';
import { prisma, safeQuery } from '../config/prisma';
import { REFERENCE_CONSTRUCTORS, REFERENCE_DRIVERS, referenceIds } from '../config/referenceData';
import { getOpenF1SeasonStats, getOpenF1TeamStandings, type OpenF1Driver } from './openf1.service';
import { getOpenF1Championship, getOpenF1Drivers } from './liveSession.service';
import { getMotoGPStandings } from './motogp.service';
import { teamColor } from '../config/teamColors';
import { fullTeamName, shortTeamName } from '../config/teamNames';
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

async function loadOpenF1DriverStandings(
  series: Series,
): Promise<StandingsResult<DriverStanding> | null> {
  const [championship, drivers] = await Promise.allSettled([
    getOpenF1Championship(),
    getOpenF1Drivers(),
  ]);

  const table = championship.status === 'fulfilled' ? championship.value : [];
  const roster: Map<number, OpenF1Driver> =
    drivers.status === 'fulfilled' ? drivers.value : new Map();
  if (table.length === 0 || roster.size === 0) return null;

  // Wins/podiums come from the season scan (not in the championship feed).
  const season = getOpenF1SeasonStats();

  const standings = buildDriverStandings(
    table.map((entry) => {
      const driver = roster.get(entry.driverNumber);
      return {
        driverId: `openf1:driver:${entry.driverNumber}`,
        code: driver?.code ?? `#${entry.driverNumber}`,
        driverNumber: entry.driverNumber,
        fullName: driver?.fullName ?? `Car ${entry.driverNumber}`,
        teamName: driver?.teamName ?? 'Unknown',
        series,
        points: round(entry.points, 1),
        wins: season?.wins.get(entry.driverNumber) ?? 0,
        podiums: season?.podiums.get(entry.driverNumber) ?? 0,
      };
    }),
  );

  return {
    series,
    updatedAt: new Date().toISOString(),
    count: standings.length,
    leaderPoints: standings[0]?.points ?? 0,
    standings,
    degraded: false,
  };
}

async function loadOpenF1ConstructorStandings(
  series: Series,
): Promise<StandingsResult<ConstructorStanding> | null> {
  const teams = await getOpenF1TeamStandings().catch(() => []);
  if (teams.length === 0) return null;

  const { data: dbTeams } = await safeQuery(
    'standings.openf1_team_meta',
    () => prisma.constructor.findMany({ where: { series } }),
    () => [] as Array<{ name: string; colorHex: string }>,
  );
  const dbByName = new Map(dbTeams.map((team) => [team.name.toLowerCase(), team]));

  const standings = buildConstructorStandings(
    teams.map((team) => ({
      constructorId: `openf1:team:${team.teamName}`,
      name: team.teamName,
      series,
      points: round(team.points, 1),
      colorHex:
        dbByName.get(team.teamName.toLowerCase())?.colorHex ??
        dbByName.get(shortTeamName(team.teamName).toLowerCase())?.colorHex ??
        teamColor(team.teamName),
    })),
  );

  return {
    series,
    updatedAt: new Date().toISOString(),
    count: standings.length,
    leaderPoints: standings[0]?.points ?? 0,
    standings,
    degraded: false,
  };
}

async function loadMotoGPDriverStandings(
  series: Series,
): Promise<StandingsResult<DriverStanding> | null> {
  const data = await getMotoGPStandings().catch(() => null);
  if (!data || data.riders.length === 0) return null;

  const standings = buildDriverStandings(
    data.riders.map((rider) => ({
      driverId: `motogp:rider:${rider.riderNumber}`,
      code: rider.code,
      driverNumber: rider.riderNumber,
      fullName: rider.fullName,
      teamName: rider.teamName,
      series,
      points: round(rider.points, 1),
      wins: rider.wins,
      podiums: rider.podiums,
    })),
  );

  return {
    series,
    updatedAt: data.updatedAt,
    count: standings.length,
    leaderPoints: standings[0]?.points ?? 0,
    standings,
    degraded: false,
  };
}

async function loadMotoGPConstructorStandings(
  series: Series,
): Promise<StandingsResult<ConstructorStanding> | null> {
  const data = await getMotoGPStandings().catch(() => null);
  if (!data || data.teams.length === 0) return null;

  const standings = buildConstructorStandings(
    data.teams.map((team) => ({
      constructorId: `motogp:team:${team.name}`,
      name: team.name,
      series,
      points: round(team.points, 1),
      colorHex: teamColor(team.name),
    })),
  );

  return {
    series,
    updatedAt: data.updatedAt,
    count: standings.length,
    leaderPoints: standings[0]?.points ?? 0,
    standings,
    degraded: false,
  };
}

export async function getDriverStandings(series: Series): Promise<StandingsResult<DriverStanding>> {
  // Real F1 championship from OpenF1; real MotoGP table from Pulse Live.
  if (series === Series.F1) {
    const openF1 = await loadOpenF1DriverStandings(series);
    if (openF1) return openF1;
  }

  if (series === Series.MOTOGP) {
    const motogp = await loadMotoGPDriverStandings(series);
    if (motogp) return motogp;
  }

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
      teamName: series === Series.F1 ? fullTeamName(driver.teamName) : driver.teamName,
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
  if (series === Series.F1) {
    const openF1 = await loadOpenF1ConstructorStandings(series);
    if (openF1) return openF1;
  }

  if (series === Series.MOTOGP) {
    const motogp = await loadMotoGPConstructorStandings(series);
    if (motogp) return motogp;
  }

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
      name: series === Series.F1 ? fullTeamName(constructor.name) : constructor.name,
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
