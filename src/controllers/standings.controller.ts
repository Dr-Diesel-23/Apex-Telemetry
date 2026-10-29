import type { Request, Response } from 'express';
import { seriesFromRequest } from './seriesParam';
import {
  getConstructorStandings,
  getDriverStandings,
} from '../services/standings.service';

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
