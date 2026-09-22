import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { PwaRegister } from '@/components/pwa-register';
import { geistMono, geistUi } from '@/lib/fonts';

import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ProcureFlow',
  description: 'Multi-tenant Procure-to-Pay for Indian manufacturing',
  // Installable app shell — see public/app-sw.js. The vendor portal and the
  // scanner layouts swap in their own manifests.
  manifest: '/app.webmanifest',
  applicationName: 'ProcureFlow',
  appleWebApp: { capable: true, title: 'ProcureFlow', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/app-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/app-apple-touch-180.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <html
      lang="en"
      className={`${geistUi.variable} ${geistMono.variable}`}
    >
      <body className="bg-paper text-text min-h-screen antialiased">
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
