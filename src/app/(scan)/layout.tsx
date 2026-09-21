import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { ScanShell } from '@/components/scan/scan-shell';
import { colors } from '@/components/ui/tokens';

export const metadata: Metadata = {
  title: 'ProcureFlow Scanner',
  description: 'Warehouse scanning: receive, putaway, pick, count and transfer.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    // iOS ignores the web manifest's display mode; this is what makes an
    // added-to-home-screen launch open without Safari's chrome.
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Scanner',
  },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  // The browser chrome colour on a handset; taken from the token so it tracks
  // the palette rather than a hex nobody updates.
  themeColor: colors.ink,
  width: 'device-width',
  initialScale: 1,
  // No zoom-out on rotate, and the safe-area insets a notched handset needs
  // when the app runs full-screen from the home screen.
  maximumScale: 1,
  viewportFit: 'cover',
};

/**
 * The scanner is its own shell, not a page inside the desktop app.
 *
 * It runs one-handed on a phone in a warehouse: no sidebar, no command palette,
 * large touch targets, and the sync state visible at all times. Sharing the
 * buyer app's chrome would put a 240px navigation rail on a 360px screen.
 */
export default function ScanLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return <ScanShell>{children}</ScanShell>;
}
