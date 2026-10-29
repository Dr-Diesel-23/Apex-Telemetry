import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 6.19+ config file. Replaces the deprecated `package.json#prisma` block
 * and is forward-compatible with Prisma 7.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
