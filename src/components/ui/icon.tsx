import { getIconData, iconToSVG } from '@iconify/utils';
import { icons as lucideJSON } from '@iconify-json/lucide';

import { cn } from '@/lib/utils';

/**
 * Thin wrapper over Iconify offline data so icons are server-rendered.
 * The project only uses 'lucide:' icons, so we bundle @iconify-json/lucide.
 * Inherits `currentColor` and a consistent size.
 */
export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const [prefix, iconName] = name.split(':');

  if (prefix !== 'lucide' || !iconName) {
    console.warn(`Icon prefix must be 'lucide:', got '${name}'`);
    return null;
  }

  const iconData = getIconData(lucideJSON, iconName);
  if (!iconData) {
    console.warn(`Icon '${iconName}' not found in lucide collection`);
    return null;
  }

  const renderData = iconToSVG(iconData, {
    height: 'auto', // We control size via tailwind size utility
  });

  return (
    <svg
      {...renderData.attributes}
      dangerouslySetInnerHTML={{ __html: renderData.body }}
      className={cn('size-[1.15em] shrink-0', className)}
      aria-hidden
    />
  );
}
