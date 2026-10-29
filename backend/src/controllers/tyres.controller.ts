import type { Request, Response } from 'express';
import { Series } from '@prisma/client';
import { emptyTyreStrategy, getTyreStrategy } from '../services/tyre.service';
import { seriesFromRequest } from './seriesParam';

/**
 * GET /api/v1/:series/tyres
 *
 * Per-driver stint history, current compound and pit stops. OpenF1 only
 * publishes this for F1; other series return an empty, degraded payload so the
 * dashboard can hide the panel without treating it as an error.
 */
export async function tyres(req: Request, res: Response): Promise<void> {
  const series = seriesFromRequest(req);
  const result = series === Series.F1 ? await getTyreStrategy(series) : null;
  res.json(result ?? emptyTyreStrategy(series));
}
