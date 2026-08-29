import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe for the Docker healthcheck. Deliberately does not touch Postgres:
 * a database blip should not make Swarm kill and restart otherwise healthy tasks.
 */
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
