/**
 * Client-side analytics transport. Fire-and-forget by design: a failed event
 * must never surface to the user or block an interaction.
 */
export function trackClient(
  action: string,
  data: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({ action, data });

  // sendBeacon survives the page being closed mid-navigation, which is exactly
  // when a "clicked download then left" event would otherwise be lost.
  if (typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon('/api/analytics', blob)) return;
  }

  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* analytics is best effort */
  });
}
