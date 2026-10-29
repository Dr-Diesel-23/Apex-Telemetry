import { Series, SessionType } from '@prisma/client';

export const SERIES_LABELS: Record<Series, string> = {
  F1: 'Formula 1',
  F2: 'Formula 2',
  MOTOGP: 'MotoGP',
};

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  PRACTICE: 'Practice',
  QUALIFYING: 'Qualifying',
  SPRINT: 'Sprint',
  RACE: 'Race',
};

/**
 * Accepts the loosely-typed values that arrive from URLs (`motogp`, `moto-gp`,
 * `formula-1`, ...) and normalises them onto the Prisma enum.
 */
export function parseSeriesParam(value: string | undefined): Series | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/[\s_-]/g, '');

  switch (normalized) {
    case 'F1':
    case 'FORMULA1':
      return Series.F1;
    case 'F2':
    case 'FORMULA2':
      return Series.F2;
    case 'MOTOGP':
    case 'MOTO':
    case 'GP':
      return Series.MOTOGP;
    default:
      return null;
  }
}

export function parseSessionTypeParam(value: string | undefined): SessionType | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return (Object.values(SessionType) as string[]).includes(normalized)
    ? (normalized as SessionType)
    : null;
}

export function seriesSlug(series: Series): string {
  return series.toLowerCase();
}
