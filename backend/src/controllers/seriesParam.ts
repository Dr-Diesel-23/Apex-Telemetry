import type { Request } from 'express';
import { parseSeriesParam } from '../config/series';
import { HttpError } from '../utils/httpError';

/** Reads `:series` from the URL and normalises it onto the Prisma enum. */
export function seriesFromRequest(req: Request) {
  const raw = Array.isArray(req.params.series) ? req.params.series[0] : req.params.series;
  const series = parseSeriesParam(raw);
  if (!series) {
    throw HttpError.badRequest(`Unknown series '${raw ?? ''}'. Use f1, f2 or motogp.`);
  }
  return series;
}
