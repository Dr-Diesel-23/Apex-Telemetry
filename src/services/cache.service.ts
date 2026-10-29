import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface MemoryEntry {
  payload: string;
  expiresAt: number;
}

const memory = new Map<string, MemoryEntry>();

let redis: Redis | null = null;
let redisReady = false;

if (env.REDIS_ENABLED) {
  redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1_500,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
  });

  redis.on('ready', () => {
    redisReady = true;
    logger.info('redis.connected', { url: env.REDIS_URL });
  });
  redis.on('error', (error: Error) => {
    redisReady = false;
    logger.warn('redis.error', { message: error.message });
  });
  redis.on('end', () => {
    redisReady = false;
  });

  redis.connect().catch((error: Error) => {
    logger.warn('redis.connect_failed', {
      message: error.message,
      hint: 'Falling back to in-process cache.',
    });
  });
}

function readMemory<T>(key: string): T | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.payload) as T;
  } catch {
    memory.delete(key);
    return null;
  }
}

function writeMemory(key: string, payload: string, ttlSeconds: number): void {
  memory.set(key, { payload, expiresAt: Date.now() + ttlSeconds * 1_000 });
  // Opportunistic sweep — the cache is small, so a full scan is cheap.
  if (memory.size > 500) {
    const now = Date.now();
    for (const [entryKey, entry] of memory) {
      if (entry.expiresAt < now) memory.delete(entryKey);
    }
  }
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (redis && redisReady) {
      try {
        const payload = await redis.get(key);
        if (payload) return JSON.parse(payload) as T;
        return null;
      } catch {
        // fall through to memory
      }
    }
    return readMemory<T>(key);
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (redis && redisReady) {
      try {
        await redis.set(key, payload, 'EX', Math.max(1, Math.floor(ttlSeconds)));
        return;
      } catch {
        // fall through to memory
      }
    }
    writeMemory(key, payload, ttlSeconds);
  },

  async del(key: string): Promise<void> {
    memory.delete(key);
    if (redis && redisReady) {
      await redis.del(key).catch(() => undefined);
    }
  },

  async close(): Promise<void> {
    memory.clear();
    if (redis) {
      redis.disconnect();
      redis = null;
      redisReady = false;
    }
  },
};

export function cacheBackend(): 'redis' | 'memory' {
  return redis && redisReady ? 'redis' : 'memory';
}
