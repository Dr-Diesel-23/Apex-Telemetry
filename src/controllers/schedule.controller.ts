import type { Request, Response } from 'express';
import { Series } from '@prisma/client';
import type { ScheduleResult } from '../services/calendar.types';
import { getF1Schedule } from '../services/jolpica.service';
import { getMotoGPSchedule } from '../services/motogp.service';
import { seriesFromRequest } from './seriesParam';

/**
 * GET /api/v1/:series/schedule
 *
 * F1 calendar from Jolpica, MotoGP calendar from Pulse Live. Both are free and
 * key-less. F2 has no upstream and returns an empty calendar.
 */
export async function schedule(req: Request, res: Response): Promise<void> {
  const series = seriesFromRequest(req);

  let result: ScheduleResult | null = null;
  if (series === Series.F1) {
    result = await getF1Schedule().catch(() => null);
  } else if (series === Series.MOTOGP) {
    result = await getMotoGPSchedule().catch(() => null);
  }

  res.json(
    result ?? {
      series,
      season: new Date().getUTCFullYear(),
      next: null,
      last: null,
      races: [],
      updatedAt: new Date().toISOString(),
      source: series === Series.MOTOGP ? 'motogp' : 'jolpica',
    },
  );
}
