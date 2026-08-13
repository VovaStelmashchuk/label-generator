import { NextResponse } from 'next/server';

import { track } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ACTION_LENGTH = 64;
const MAX_DATA_BYTES = 4096;

/**
 * Sink for client-side events (page views, button clicks). The device id comes
 * from the cookie on this request, never from the body, so a client cannot
 * attribute events to somebody else.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const { action, data } = (body ?? {}) as {
    action?: unknown;
    data?: unknown;
  };

  if (typeof action !== 'string' || action.trim() === '') {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  const payload =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  if (JSON.stringify(payload).length > MAX_DATA_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  await track(action.slice(0, MAX_ACTION_LENGTH), payload);

  // 204 keeps `navigator.sendBeacon` and `fetch(keepalive)` callers cheap.
  return new NextResponse(null, { status: 204 });
}
