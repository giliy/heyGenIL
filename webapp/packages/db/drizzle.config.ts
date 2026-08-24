import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // Container Postgres is exposed on host 5434 (5432/5433 are taken by the
    // machine's own Postgres services — see webapp/docker-compose.yml).
    url: process.env.DATABASE_URL ?? 'postgres://shorts:shorts@localhost:5434/shorts',
  },
});
