import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import { env } from './config/env';
import { ensureDatabaseReachable, isDatabaseOnline } from './config/prisma';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { telemetrySocketStats } from './websocket/telemetry.ws';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  cors({
    origin: env.corsOrigins === true ? '*' : env.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
  }),
);
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(requestLogger);

const startedAt = Date.now();

function healthPayload() {
  const databaseOnline = isDatabaseOnline();
  return {
    status: databaseOnline ? 'ok' : 'degraded',
    service: 'apex-telemetry-backend',
    version: '1.0.0',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
    timestamp: new Date().toISOString(),
    database: { provider: 'postgresql', status: databaseOnline ? 'up' : 'down' },
    websocket: telemetrySocketStats(),
  };
}

app.get('/health', async (_req: Request, res: Response) => {
  await ensureDatabaseReachable().catch(() => false);
  res.status(200).json(healthPayload());
});

app.get('/api/v1/health', async (_req: Request, res: Response) => {
  await ensureDatabaseReachable().catch(() => false);
  res.status(200).json(healthPayload());
});

app.use('/api/v1', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
