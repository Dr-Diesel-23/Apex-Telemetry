/**
 * Shared calendar shape used by the F1 (Jolpica) and MotoGP (Pulse Live)
 * schedule endpoints. Both upstreams are free and key-less.
 */

export type RaceStatus = 'upcoming' | 'live' | 'finished';

export interface RaceSummary {
  round: number;
  name: string;
  /** Short circuit/event code when the upstream provides one (e.g. `COTA`). */
  shortName: string | null;
  circuit: string;
  locality: string;
  country: string;
  /** ISO 3166-1 alpha-2 country code, used for the flag (`MX`). */
  countryCode: string | null;
  /** Scheduled start in ISO 8601 UTC, or `null` when only a date is known. */
  startsAt: string | null;
  /** Calendar date (`YYYY-MM-DD`). */
  date: string;
  status: RaceStatus;
}

export interface ScheduleResult {
  series: 'F1' | 'F2' | 'MOTOGP';
  season: number;
  /** Next race that has not started yet. */
  next: RaceSummary | null;
  /** Most recent race that has started. */
  last: RaceSummary | null;
  races: RaceSummary[];
  updatedAt: string;
  source: 'jolpica' | 'motogp';
}
