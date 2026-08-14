'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';


import { trackClient } from '@/lib/track-client';

/**
 * Records one page_view per path with the referrer that brought the visitor in.
 * Client side on purpose: the referrer only exists in the browser, and this way
 * prefetches and bot fetches of the HTML do not count as views.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    trackClient('page_view', {
      path: pathname,
      referrer: document.referrer || null,
      title: document.title,
    });
  }, [pathname]);

  return null;
}
