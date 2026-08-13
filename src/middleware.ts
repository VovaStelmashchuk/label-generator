import { NextResponse, type NextRequest } from 'next/server';

import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE } from '@/lib/device';

/**
 * Issues the anonymous device id on the very first HTTP request, so that every
 * later analytics event - client or server - already has one to attach to.
 *
 * The cookie is httpOnly: nothing in the browser needs to read it, because
 * client events are posted to /api/analytics where the cookie travels along.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(DEVICE_COOKIE)?.value) {
    response.cookies.set({
      name: DEVICE_COOKIE,
      value: crypto.randomUUID(),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: DEVICE_COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

export const config = {
  // Everything except Next's own assets - those would only issue duplicate
  // cookies for requests that are never attributed to a person.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
