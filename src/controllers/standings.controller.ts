import type { Request, Response } from 'express';
import { parseSeriesParam } from '../config/series';
import { HttpError } from '../utils/httpError';
import {
  getConstructorStandings,
  getDriverStandings,
} from '../services/standings.service';

function seriesFromRequest(req: Request) {
  const raw = Array.isArray(req.params.series) ? req.params.series[0] : req.params.series;
  const series = parseSeriesParam(raw);
  if (!series) {
    throw HttpError.badRequest(`Unknown series '${raw ?? ''}'. Use f1, f2 or motogp.`);
  }
  return series;
}

/** GET /api/v1/:series/standings/drivers */
export async function drivers(req: Request, res: Response): Promise<void> {
  const result = await getDriverStandings(seriesFromRequest(req));
  res.json(result);
}

/** GET /api/v1/:series/standings/constructors */
export async function constructors(req: Request, res: Response): Promise<void> {
  const result = await getConstructorStandings(seriesFromRequest(req));
  res.json(result);
}
