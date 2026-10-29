import { Series } from '@prisma/client';
import { getOpenF1Context, type OpenF1Context, type OpenF1Stint } from './openf1.service';

/**
 * Tyre strategy for the live/replayed F1 session.
 *
 * OpenF1 exposes `/stints` (compound + lap window + tyre age at start) and
 * `/pit` (pit-lane time per stop). Both are already part of the session
 * context, so this service only shapes them for the dashboard.
 */

export type TyreCompoundCode = 'S' | 'M' | 'H' | 'I' | 'W' | 'U';

export interface TyreCompound {
  code: TyreCompoundCode;
  label: string;
  /** Pirelli sidewall colour. */
  colorHex: string;
  /** Readable text colour on top of `colorHex`. */
  textColor: string;
}

const COMPOUNDS: Record<string, TyreCompound> = {
  SOFT: { code: 'S', label: 'SOFT', colorHex: '#FF3333', textColor: '#FFFFFF' },
  MEDIUM: { code: 'M', label: 'MEDIUM', colorHex: '#FFD400', textColor: '#11161D' },
  HARD: { code: 'H', label: 'HARD', colorHex: '#F2F2F2', textColor: '#11161D' },
  INTERMEDIATE: { code: 'I', label: 'INTERMEDIATE', colorHex: '#43B02A', textColor: '#FFFFFF' },
  WET: { code: 'W', label: 'WET', colorHex: '#2E7DD1', textColor: '#FFFFFF' },
  UNKNOWN: { code: 'U', label: 'UNKNOWN', colorHex: '#8C99A5', textColor: '#11161D' },
};

export function compoundFor(raw: string | null | undefined): TyreCompound {
  const key = String(raw ?? '').trim().toUpperCase();
  return COMPOUNDS[key] ?? COMPOUNDS.UNKNOWN;
}

export interface TyreStintDto {
  stintNumber: number;
  compound: TyreCompoundCode;
  compoundLabel: string;
  colorHex: string;
  startLap: number;
  endLap: number;
  /** Laps completed on this set (excludes laps run before the stint). */
  laps: number;
  tyreAgeAtStart: number;
}

export interface TyrePitStopDto {
  lapNumber: number;
  /** Pit-lane time in seconds, `null` when the feed omitted it. */
  durationSeconds: number | null;
  date: string;
}

export interface TyreDriverDto {
  position: number;
  driverNumber: number;
  code: string;
  fullName: string;
  teamName: string;
  teamColor: string;
  /** Compound currently fitted (last stint). */
  compound: TyreCompoundCode;
  compoundLabel: string;
  colorHex: string;
  textColor: string;
  /** Laps run on the current set, including any laps before this stint. */
  currentTyreLaps: number;
  stints: TyreStintDto[];
  pitStops: TyrePitStopDto[];
  pitCount: number;
  /** Compact strategy string, e.g. `S 13 · M 18 · H 25`. */
  strategy: string;
}

export interface TyreStrategyResult {
  series: Series;
  sessionKey: number;
  sessionName: string;
  circuit: string;
  totalLaps: number;
  updatedAt: string;
  source: 'openf1' | 'none';
  degraded: boolean;
  drivers: TyreDriverDto[];
}

function toDto(stint: OpenF1Stint): TyreStintDto {
  const compound = compoundFor(stint.compound);
  const laps = Math.max(0, stint.lapEnd - stint.lapStart + 1);

  return {
    stintNumber: stint.stintNumber,
    compound: compound.code,
    compoundLabel: compound.label,
    colorHex: compound.colorHex,
    startLap: stint.lapStart,
    endLap: stint.lapEnd,
    laps,
    tyreAgeAtStart: stint.tyreAgeAtStart,
  };
}

function buildDrivers(context: OpenF1Context): TyreDriverDto[] {
  return context.drivers
    .map((driver) => {
      const stints = (context.stints.get(driver.driverNumber) ?? []).map(toDto);
      const current = stints.at(-1);
      const compound = compoundFor(current?.compoundLabel);

      const pitStops = (context.pitStops.get(driver.driverNumber) ?? []).map((stop) => ({
        lapNumber: stop.lapNumber,
        durationSeconds:
          typeof stop.pitDuration === 'number' ? Math.round(stop.pitDuration * 10) / 10 : null,
        date: stop.date,
      }));

      return {
        position: context.positions.get(driver.driverNumber) ?? 99,
        driverNumber: driver.driverNumber,
        code: driver.code,
        fullName: driver.fullName,
        teamName: driver.teamName,
        teamColor: /^#[0-9a-f]{6}$/i.test(driver.teamColour) ? driver.teamColour : '#8C99A5',
        compound: compound.code,
        compoundLabel: compound.label,
        colorHex: compound.colorHex,
        textColor: compound.textColor,
        currentTyreLaps: current ? current.laps + current.tyreAgeAtStart : 0,
        stints,
        pitStops,
        pitCount: pitStops.length,
        strategy: stints.map((stint) => `${stint.compound} ${stint.laps}`).join(' · '),
      } satisfies TyreDriverDto;
    })
    .sort((a, b) => a.position - b.position);
}

/** Tyre strategy for the OpenF1 session, or `null` when it is unavailable. */
export async function getTyreStrategy(series: Series): Promise<TyreStrategyResult | null> {
  if (series !== Series.F1) return null;

  const context = await getOpenF1Context();
  if (!context) return null;

  const drivers = buildDrivers(context);
  if (drivers.length === 0) return null;

  return {
    series,
    sessionKey: context.session.sessionKey,
    sessionName: context.session.sessionName,
    circuit: context.session.circuitShortName,
    totalLaps: context.totalLaps,
    updatedAt: new Date(context.fetchedAt).toISOString(),
    source: 'openf1',
    degraded: false,
    drivers,
  };
}

/** Empty payload used when OpenF1 is disabled or unreachable. */
export function emptyTyreStrategy(series: Series): TyreStrategyResult {
  return {
    series,
    sessionKey: 0,
    sessionName: 'No session',
    circuit: '—',
    totalLaps: 0,
    updatedAt: new Date().toISOString(),
    source: 'none',
    degraded: true,
    drivers: [],
  };
}
