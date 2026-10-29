import type { Request, Response } from 'express';
import { z } from 'zod';
import { parseSeriesParam } from '../config/series';
import { HttpError } from '../utils/httpError';
import { parseQuery } from '../middleware/validate';
import { compareDrivers } from '../services/telemetry.service';

const compareQuery = z.object({
  driver1: z.string().min(1, 'driver1 is required'),
  driver2: z.string().min(1, 'driver2 is required'),
  sessionId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(2).max(600).default(120),
});

/** GET /api/v1/:series/telemetry/compare?driver1=VER&driver2=NOR */
export async function compare(req: Request, res: Response): Promise<void> {
  const raw = Array.isArray(req.params.series) ? req.params.series[0] : req.params.series;
  const series = parseSeriesParam(raw);
  if (!series) {
    throw HttpError.badRequest(`Unknown series '${raw ?? ''}'. Use f1, f2 or motogp.`);
  }

  const query = parseQuery(compareQuery, req);
  const result = await compareDrivers(
    series,
    query.driver1,
    query.driver2,
    query.sessionId,
    query.limit,
  );

  res.json(result);
}
