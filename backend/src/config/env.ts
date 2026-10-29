import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment contract. The process refuses to boot with an invalid config
 * instead of failing later on a random `undefined` deep inside a request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (postgresql://user:pass@host:5432/db)'),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_ENABLED: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())),

  OPEN_METEO_BASE_URL: z.string().url().default('https://api.open-meteo.com/v1/forecast'),
  WEATHER_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  OPENF1_ENABLED: z
    .string()
    .default('true')
    .transform((value) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())),
  OPENF1_BASE_URL: z.string().url().default('https://api.openf1.org/v1'),
  OPENF1_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(8_000),
  /** Seconds of car telemetry kept in the replay/live buffer. */
  OPENF1_WINDOW_SECONDS: z.coerce.number().int().min(20).max(300).default(90),

  /**
   * Jolpica is the community successor to Ergast (no API key). Used for the F1
   * race calendar, and as a standings fallback.
   */
  JOLPICA_ENABLED: z
    .string()
    .default('true')
    .transform((value) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())),
  JOLPICA_BASE_URL: z.string().url().default('https://api.jolpi.ca/ergast/f1'),

  /**
   * MotoGP publishes its results through the public Pulse Live API that powers
   * motogp.com. No key, no quota worth worrying about.
   */
  MOTOGP_API_ENABLED: z
    .string()
    .default('true')
    .transform((value) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())),
  MOTOGP_API_BASE_URL: z
    .string()
    .url()
    .default('https://api.motogp.pulselive.com/motogp/v1'),

  /**
   * Live telemetry is only streamed while a session is running. Set this to
   * `true` to fall back to the deterministic simulator when the track is
   * quiet (handy for demos, never for production).
   */
  SIMULATED_TELEMETRY: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())),

  WS_PATH: z.string().startsWith('/').default('/ws/telemetry'),
  WS_BROADCAST_INTERVAL_MS: z.coerce.number().int().min(100).max(10_000).default(500),

  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  /** `true` = allow any origin, otherwise an explicit allow-list. */
  corsOrigins:
    raw.CORS_ORIGIN.trim() === '*'
      ? true
      : raw.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  /** Telemetry frames per second, derived from the broadcast interval. */
  wsBroadcastHz: Math.round(1000 / raw.WS_BROADCAST_INTERVAL_MS),
} as const;

export type Env = typeof env;
