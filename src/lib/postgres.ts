import { Pool } from 'pg';

const globalForPg = globalThis as unknown as {
  __labelGeneratorPgPool?: Pool;
};

let created: Pool | undefined;

/**
 * The pool is built on first use, never at import time. `next build` evaluates
 * every server module while collecting page data, with none of the runtime
 * environment set - throwing at module scope there fails the image build rather
 * than the request that actually wanted a database.
 */
function getPool(): Pool {
  if (created) return created;

  if (globalForPg.__labelGeneratorPgPool) {
    created = globalForPg.__labelGeneratorPgPool;
    return created;
  }

  const uri = process.env.POSTGRES_URI;
  if (!uri) {
    throw new Error('POSTGRES_URI environment variable is not defined');
  }

  created = new Pool({ connectionString: uri });

  if (process.env.NODE_ENV !== 'production') {
    globalForPg.__labelGeneratorPgPool = created;
  }

  return created;
}

/**
 * A lazily-bound stand-in for the pool, so every `pool.query(...)` call site
 * reads exactly as it would against the real thing.
 */
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const target = getPool();
    const value = Reflect.get(target, prop, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

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
      -- A user is identified by id alone; 
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
        ip INET
      );

      DO $$
      BEGIN
        IF EXISTS(SELECT 1
          FROM information_schema.columns
          WHERE table_name='analytics_events' and column_name='country')
        THEN
            ALTER TABLE analytics_events RENAME COLUMN country TO ip;
        END IF;

        IF EXISTS(SELECT 1
          FROM information_schema.columns
          WHERE table_name='analytics_events' and column_name='ip' and data_type='text')
        THEN
            ALTER TABLE analytics_events ALTER COLUMN ip TYPE INET USING ip::inet;
        END IF;
      END $$;
    `).then(() => { });
  }
  return initPromise;
}
