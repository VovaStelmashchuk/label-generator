import { Pool } from 'pg';

const uri = process.env.POSTGRES_URI;

if (!uri) {
  throw new Error('POSTGRES_URI environment variable is not defined');
}

const globalForPg = globalThis as unknown as {
  __labelGeneratorPgPool?: Pool;
};

export const pool =
  globalForPg.__labelGeneratorPgPool ??
  new Pool({
    connectionString: uri,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.__labelGeneratorPgPool = pool;
}

let initPromise: Promise<void> | null = null;

export async function ensureDb() {
  if (!initPromise) {
    initPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        metadata JSONB,
        data BYTEA NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Created before analytics_events, which points its user_id at it.
      -- A user is identified by id alone; meta carries whatever the identity
      -- provider handed us (currently just googleId), which the app never
      -- treats as a key outside of matching a returning sign-in.
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        roles JSONB NOT NULL DEFAULT '["user"]'::jsonb,
        tokens JSONB NOT NULL DEFAULT '[]'::jsonb,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb
      );

      -- Two accounts must never claim the same Google identity; rows without
      -- one are left alone so a future provider needs no schema change.
      CREATE UNIQUE INDEX IF NOT EXISTS users_meta_google_id_idx
        ON users ((meta->>'googleId'))
        WHERE meta->>'googleId' IS NOT NULL;

      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id TEXT NOT NULL,
        user_id UUID REFERENCES users (id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        data JSONB NOT NULL,
        country TEXT
      );
    `).then(() => { });
  }
  return initPromise;
}
