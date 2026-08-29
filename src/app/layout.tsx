import type { Metadata } from 'next';

import { PageViewTracker } from '@/components/page-view-tracker';
import { Navigation } from '@/components/navigation';
import { SocketClient } from '@/components/SocketClient';
import { getUserFromServer } from '@/lib/auth';

import './globals.css';

export const metadata: Metadata = {
  title: 'Label Generator',
  description:
    'Make printable labels for jars, zip bags and shelves. One A4 page, printed at home.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getUserFromServer();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/auth/google/callback`;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=openid email profile&prompt=consent`;

  return (
    <html lang="en">
      <body suppressHydrationWarning className="min-h-dvh antialiased text-label-primary bg-background">
        <div className="flex flex-col md:flex-row min-h-dvh">
          <Navigation isLoggedIn={!!user} authUrl={googleAuthUrl} />
          <div className="flex-1 pb-16 md:pb-0 overflow-y-auto">
            {children}
          </div>
        </div>
        <PageViewTracker />
        <SocketClient isLoggedIn={!!user} />
      </body>
    </html>
  );
}
