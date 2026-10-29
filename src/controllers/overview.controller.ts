import type { Request, Response } from 'express';
import { z } from 'zod';
import { Series } from '@prisma/client';
import { parseQuery } from '../middleware/validate';
import { parseSeriesParam } from '../config/series';
import { HttpError } from '../utils/httpError';
import { getLiveOverview } from '../services/overview.service';
import { getPredictions } from '../services/prediction.service';
import { getNews } from '../services/news.service';

const liveQuery = z.object({
  series: z.string().min(1).optional(),
});

const predictionsQuery = z.object({
  series: z.string().min(1).optional(),
  racesRemaining: z.coerce.number().int().min(1).max(30).default(6),
});

const newsQuery = z.object({
  series: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function requireSeries(value: string): Series {
  const series = parseSeriesParam(value);
  if (!series) {
    throw HttpError.badRequest(`Unknown series '${value}'. Use f1, f2 or motogp.`);
  }
  return series;
}

/** GET /api/v1/overview/live */
export async function live(req: Request, res: Response): Promise<void> {
  const { series } = parseQuery(liveQuery, req);
  const result = await getLiveOverview(series ? requireSeries(series) : undefined);
  res.json(result);
}

/** GET /api/v1/overview/predictions */
export async function predictions(req: Request, res: Response): Promise<void> {
  const query = parseQuery(predictionsQuery, req);
  const series = query.series ? requireSeries(query.series) : null;
  if (!series) {
    throw HttpError.badRequest('The `series` query parameter is required (f1, f2 or motogp).');
  }
  const result = await getPredictions(series, query.racesRemaining);
  res.json(result);
}

/** GET /api/v1/overview/news */
export async function news(req: Request, res: Response): Promise<void> {
  const query = parseQuery(newsQuery, req);
  const series = query.series ? requireSeries(query.series) : undefined;
  const result = await getNews(series ?? undefined, query.limit);
  res.json(result);
}
