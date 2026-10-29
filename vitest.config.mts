import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://apex:apex@127.0.0.1:5432/apex_telemetry_test?schema=public';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      REDIS_ENABLED: 'false',
      LOG_LEVEL: 'error',
      WS_BROADCAST_INTERVAL_MS: '500',
      // The suite must never depend on a third-party API being reachable.
      OPENF1_ENABLED: 'false',
      JOLPICA_ENABLED: 'false',
      MOTOGP_API_ENABLED: 'false',
      // The simulator keeps the WS cadence/frame-shape tests deterministic;
      // production defaults to live-only (SIMULATED_TELEMETRY=false).
      SIMULATED_TELEMETRY: 'true',
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The WebSocket suite attaches a singleton socket server, so keep files
    // in separate workers but never run them concurrently against one DB.
    fileParallelism: false,
  },
});
