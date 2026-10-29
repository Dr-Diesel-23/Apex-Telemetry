import http from 'node:http';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase, isDatabaseOnline } from './config/prisma';
import { attachTelemetryWebSocket } from './websocket/telemetry.ws';
import { cache } from './services/cache.service';
import { getOpenF1Context } from './services/openf1.service';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  const server = http.createServer(app);
  const socketHandle = attachTelemetryWebSocket(server);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.PORT, env.HOST, () => resolve());
  });

  logger.info('server.started', {
    url: `http://localhost:${env.PORT}`,
    environment: env.NODE_ENV,
    apiBase: '/api/v1',
    websocket: `${env.WS_PATH} @ ${env.wsBroadcastHz} Hz`,
  });

  // Warm the DB connection but never block the HTTP listener on it.
  void connectDatabase();

  // Pre-fetch the latest OpenF1 session so the first dashboard load is served
  // from cache instead of waiting on six upstream calls.
  void getOpenF1Context().catch(() => undefined);

  // Recover automatically once PostgreSQL comes back (circuit breaker probe).
  const reconnectTimer = setInterval(() => {
    if (!isDatabaseOnline()) void connectDatabase();
  }, 15_000);
  reconnectTimer.unref();

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('server.shutdown_started', { signal });

    const forceExit = setTimeout(() => {
      logger.error('server.force_exit', { reason: 'graceful shutdown timed out' });
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    await socketHandle.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    clearInterval(reconnectTimer);
    await disconnectDatabase();
    await cache.close();

    logger.info('server.shutdown_complete', { signal });
    clearTimeout(forceExit);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('process.uncaught_exception', { message: error.message, stack: error.stack });
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((error: unknown) => {
  logger.error('server.bootstrap_failed', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
