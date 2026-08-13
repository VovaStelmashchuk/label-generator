'use client';

import { Icon as IconifyIcon } from '@iconify/react';

import { cn } from '@/lib/utils';

/**
 * Thin wrapper over Iconify so icon names live in one vocabulary and every icon
 * inherits `currentColor` and a consistent size. Names are Iconify ids, e.g.
 * "lucide:download" - the project ships no SVG files of its own.
 */
export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <IconifyIcon
      icon={name}
      aria-hidden
      className={cn('size-[1.15em] shrink-0', className)}
    />
  );
}
