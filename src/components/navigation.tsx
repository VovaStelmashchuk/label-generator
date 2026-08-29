'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Navigation({ isLoggedIn, authUrl }: { isLoggedIn: boolean; authUrl: string }) {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home', icon: 'lucide:home' },
    { href: '/generator', label: 'Generator', icon: 'lucide:tag' },
    { href: isLoggedIn ? '/profile' : authUrl, label: isLoggedIn ? 'Profile' : 'Sign In', icon: isLoggedIn ? 'lucide:user' : 'lucide:log-in' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-separator-secondary bg-surface shrink-0">
        <div className="p-6 border-b border-separator-secondary flex items-center gap-2">
          <Icon name="lucide:tag" className="size-6 text-accent-primary" />
          <span className="font-semibold text-lg tracking-tight">LabelGen</span>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Button
                key={link.label}
                href={link.href}
                variant={isActive ? 'primary' : 'ghost'}
                icon={link.icon}
                className="w-full justify-start"
              >
                {link.label}
              </Button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-separator-secondary bg-surface pb-safe pt-2 px-2 shadow-[0_-4px_24px_rgba(0,0,0,0.05)]">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                'flex flex-col items-center justify-center w-16 h-12 rounded-md transition-colors',
                isActive
                  ? 'text-accent-primary'
                  : 'text-label-tertiary hover:text-label-primary'
              )}
              aria-label={link.label}
            >
              <Icon name={link.icon} className={cn('size-6', isActive && 'fill-accent-primary/20')} />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
