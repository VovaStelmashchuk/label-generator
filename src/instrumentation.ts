export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // A missing secret only surfaces at the first sign-in otherwise, because
    // verifyAuthToken swallows its errors and just reports "logged out".
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is not set. Refusing to start: sessions would be forgeable.');
      process.exit(1);
    }

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
