import type { Metadata } from 'next';

import { PageViewTracker } from '@/components/page-view-tracker';

import './globals.css';

export const metadata: Metadata = {
  title: 'Label Generator',
  description:
    'Make printable labels for jars, zip bags and shelves. One A4 page, printed at home.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {children}
        <PageViewTracker />
      </body>
    </html>
  );
}
