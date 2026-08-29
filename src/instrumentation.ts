export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureDb } = await import('./lib/postgres');

    try {
      await ensureDb();
      console.log('✅ Successfully connected to Postgres database and verified schema.');
    } catch (error) {
      console.error('❌ Failed to connect to Postgres database. The application cannot start without it.');
      console.error(error);
      process.exit(1);
    }
  }
}
