import 'server-only';

import { cookies } from 'next/headers';

import { DEVICE_COOKIE } from './device';
import { getDb } from './mongo';

export type { Action } from './analytics-actions';

export const ANALYTICS_COLLECTION = 'analytics_events';

/**
 * Every tracked interaction lands in one collection with the same shape, so a
 * new event type never needs a schema change - only a new `action` string.
 */
export interface AnalyticsEvent {
  deviceId: string;
  action: string;
  time: Date;
  data: Record<string, unknown>;
  /**
   * Reserved for IP-derived geography. Left null for now: resolving it needs
   * either a header from the reverse proxy or a bundled IP database.
   */
  country: string | null;
}



export async function currentDeviceId(): Promise<string> {
  const store = await cookies();
  // The middleware sets this on the first request; the fallback only matters
  // for clients that refuse cookies, and keeps those events from being dropped.
  return store.get(DEVICE_COOKIE)?.value ?? 'unknown';
}

/**
 * Records an event. Analytics must never break a print, so a failure to write
 * is logged and swallowed rather than propagated to the caller.
 */
export async function track(
  action: string,
  data: Record<string, unknown> = {},
  deviceId?: string,
): Promise<void> {
  try {
    const event: AnalyticsEvent = {
      deviceId: deviceId ?? (await currentDeviceId()),
      action,
      time: new Date(),
      data,
      country: null,
    };

    const db = await getDb();
    await db.collection<AnalyticsEvent>(ANALYTICS_COLLECTION).insertOne(event);
  } catch (error) {
    console.error('[analytics] failed to record %s', action, error);
  }
}
