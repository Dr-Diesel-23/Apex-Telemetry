import { Prisma, PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Single Prisma instance for the whole process. In dev we stash it on
 * `globalThis` so ts-node restarts don't exhaust the connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
    errorFormat: 'minimal',
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

/** How long we trust a "database is down" verdict before probing again. */
const RETRY_COOLDOWN_MS = 15_000;
/** Health checks reuse a recent probe instead of pinging on every request. */
const PROBE_TTL_MS = 5_000;

let databaseOnline = false;
let lastFailureAt = 0;
let lastProbeAt = 0;

export function isDatabaseOnline(): boolean {
  return databaseOnline;
}

/**
 * Used by the health endpoint: refreshes the connectivity flag (at most once
 * every 5 s) so `/health` is truthful even before the first query runs.
 */
export async function ensureDatabaseReachable(): Promise<boolean> {
  if (databaseOnline && Date.now() - lastProbeAt < PROBE_TTL_MS) return true;
  if (shouldSkipDatabase()) return false;
  lastProbeAt = Date.now();
  return connectDatabase();
}

function isConnectivityError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;

  const message = error instanceof Error ? error.message : '';
  return /can't reach database server|econnrefused|enotfound|etimedout|connection pool|timed out fetching a new connection|server has closed the connection/i.test(
    message,
  );
}

function markOffline(error: unknown, label: string): void {
  databaseOnline = false;
  lastFailureAt = Date.now();
  logger.warn('database.offline', {
    label,
    message: error instanceof Error ? error.message : String(error),
    retryInMs: RETRY_COOLDOWN_MS,
  });
}

/**
 * Circuit breaker: while the DB is known-down, requests short-circuit to the
 * fallback data instead of paying Prisma's connection timeout on every call.
 */
export function shouldSkipDatabase(): boolean {
  return !databaseOnline && lastFailureAt > 0 && Date.now() - lastFailureAt < RETRY_COOLDOWN_MS;
}

export async function connectDatabase(): Promise<boolean> {
  if (shouldSkipDatabase()) return false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    if (!databaseOnline) {
      logger.info('database.connected', { provider: 'postgresql' });
    }
    databaseOnline = true;
    lastFailureAt = 0;
    return true;
  } catch (error) {
    markOffline(error, 'connect');
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect().catch(() => undefined);
  databaseOnline = false;
}

/**
 * Runs a Prisma query and falls back to reference data when the database is
 * unreachable or empty. Keeps the dashboard useful during local development.
 */
export async function safeQuery<T>(
  label: string,
  query: () => Promise<T>,
  fallback: () => T,
): Promise<{ data: T; degraded: boolean }> {
  if (shouldSkipDatabase()) {
    return { data: fallback(), degraded: true };
  }

  try {
    const data = await query();
    databaseOnline = true;
    return { data, degraded: false };
  } catch (error) {
    if (isConnectivityError(error)) {
      markOffline(error, label);
    } else {
      logger.warn('database.query_failed', {
        label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return { data: fallback(), degraded: true };
  }
}
