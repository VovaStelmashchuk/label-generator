import 'server-only';

import { after } from 'next/server';
import { cookies } from 'next/headers';

import { DEVICE_COOKIE } from './device';
import { pool, ensureDb } from './postgres';

import { verifyAuthToken } from './auth';

export type { Action } from './analytics-actions';

export const ANALYTICS_COLLECTION = 'analytics_events';

/**
 * Every tracked interaction lands in one collection with the same shape, so a
 * new event type never needs a schema change - only a new `action` string.
 */
export interface AnalyticsEvent {
  deviceId: string;
  /** `users.id` UUID, or null when nobody is signed in. Never the Google id. */
  userId: string | null;
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
  return store.get(DEVICE_COOKIE)?.value ?? 'unknown';
}

/**
 * The signed-in user's `users.id`. `verifyAuthToken` rejects a token whose
 * claim is not a UUID, so a session issued back when the claim was the Google
 * id reads as anonymous rather than writing a foreign id into the column.
 */
export async function currentUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get("auth_token")?.value;
  if (!token) return null;
  const decoded = verifyAuthToken(token);
  return decoded ? decoded.userId : null;
}

export async function track(
  action: string,
  data: Record<string, unknown> = {},
  deviceId?: string,
): Promise<void> {
  const resolvedDeviceId = deviceId ?? (await currentDeviceId());
  const userId = await currentUserId().catch(() => null);

  after(async () => {
    try {
      const event: AnalyticsEvent = {
        deviceId: resolvedDeviceId,
        userId,
        action,
        time: new Date(),
        data,
        country: null,
      };

      await ensureDb();
      await pool.query(
        `INSERT INTO analytics_events (device_id, user_id, action, time, data, country) VALUES ($1, $2, $3, $4, $5, $6)`,
        [event.deviceId, event.userId, event.action, event.time, JSON.stringify(event.data), event.country]
      );
    } catch (error) {
      console.error('[analytics] failed to record %s', action, error);
    }
  });
}
