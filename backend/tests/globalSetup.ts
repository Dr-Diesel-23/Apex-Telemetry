import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Prepares an isolated database for the integration suite:
 *   1. creates `apex_telemetry_test` if it does not exist
 *   2. applies committed migrations
 *   3. runs the real seed script
 *
 * Override with TEST_DATABASE_URL / TEST_DATABASE_ADMIN_URL.
 */
const TEST_DB_NAME = 'apex_telemetry_test';

const ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgresql://apex:apex@127.0.0.1:5432/postgres?schema=public';

const TEST_URL =
  process.env.TEST_DATABASE_URL ??
  `postgresql://apex:apex@127.0.0.1:5432/${TEST_DB_NAME}?schema=public`;

async function ensureDatabase(): Promise<void> {
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });

  try {
    const rows = await admin.$queryRawUnsafe<Array<{ exists: boolean }>>(
      'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS "exists"',
      TEST_DB_NAME,
    );

    if (!rows[0]?.exists) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
      console.log(`✔ created test database ${TEST_DB_NAME}`);
    }
  } finally {
    await admin.$disconnect();
  }
}

export default async function setup(): Promise<void> {
  await ensureDatabase();

  const env = { ...process.env, DATABASE_URL: TEST_URL };

  console.log('→ applying migrations to test database…');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env, cwd: process.cwd() });

  console.log('→ seeding test database…');
  execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit', env, cwd: process.cwd() });
}
