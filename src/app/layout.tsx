import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { geistMono, interUi } from '@/lib/fonts';

import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ProcureFlow',
  description: 'Multi-tenant Procure-to-Pay for Indian manufacturing',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <html
      lang="en"
      className={`${interUi.variable} ${geistMono.variable}`}
    >
      <body className="bg-paper text-text min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
