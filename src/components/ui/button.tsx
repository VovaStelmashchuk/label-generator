'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Two styles and two sizes, no more. `icon` takes an Iconify name and renders on
 * the left; children are optional, so an icon-only button is just a button with
 * no children (give it an `aria-label` in that case).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 border-2 font-medium transition-colors ' +
    'disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary:
          'border-accent-primary bg-accent-primary text-white hover:bg-accent-secondary hover:border-accent-secondary',
        ghost:
          'border-transparent bg-transparent text-label-primary hover:bg-fill-secondary',
      },
      size: {
        sm: 'h-9 rounded-lg px-3 text-sm',
        md: 'h-12 rounded-xl px-5 text-base',
      },
      iconOnly: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      { size: 'sm', iconOnly: true, class: 'w-9 px-0' },
      { size: 'md', iconOnly: true, class: 'w-12 px-0' },
    ],
    defaultVariants: { variant: 'primary', size: 'md', iconOnly: false },
  },
);

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
  /** Iconify icon name rendered before the text, e.g. "lucide:download". */
  icon?: string;
  className?: string;
  children?: React.ReactNode;
};

type ButtonAsButton = ButtonBaseProps &
  Omit<React.ComponentPropsWithoutRef<'button'>, 'children' | 'className'> & {
    href?: undefined;
  };

type ButtonAsLink = ButtonBaseProps &
  Omit<React.ComponentPropsWithoutRef<'a'>, 'children' | 'className'> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const {
    variant,
    size,
    icon,
    className,
    children,
    href,
    ...rest
  } = props as ButtonBaseProps & { href?: string } & Record<string, unknown>;

  const iconOnly = icon !== undefined && children === undefined;
  const classes = cn(buttonVariants({ variant, size, iconOnly }), className);

  const content = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </>
  );

  if (typeof href === 'string') {
    // A plain anchor rather than next/link: the links this button renders point
    // at file downloads, which client-side routing cannot handle.
    return (
      <a
        href={href}
        className={classes}
        {...(rest as React.ComponentPropsWithoutRef<'a'>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      {...(rest as React.ComponentPropsWithoutRef<'button'>)}
    >
      {content}
    </button>
  );
}

export { buttonVariants };
