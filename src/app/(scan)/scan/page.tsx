'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { FailedScans } from '@/components/scan/failed-scans';

/** The five floor tasks, in the order a warehouse day runs. */
const TASKS = [
  { href: '/scan/box', label: 'Box lookup', hint: 'Scan a box — see what is inside and where it is' },
  { href: '/scan/receive', label: 'Receive', hint: 'Book stock in against a PO' },
  { href: '/scan/putaway', label: 'Putaway', hint: 'Move received stock to a bin' },
  { href: '/scan/pick', label: 'Pick', hint: 'Pick an order, oldest expiry first' },
  { href: '/scan/count', label: 'Cycle count', hint: 'Count a bin for review' },
  { href: '/scan/transfer', label: 'Transfer', hint: 'Move stock bin to bin' },
];

export default function ScanHomePage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <FailedScans />

      <nav className="space-y-2">
        {TASKS.map((task) => (
          <Link
            key={task.href}
            href={task.href}
            className="block rounded-lg border border-line bg-white px-4 py-4 hover:border-accent"
          >
            <span className="block text-[16px] font-semibold">{task.label}</span>
            <span className="block text-[13px] text-muted">{task.hint}</span>
          </Link>
        ))}
      </nav>

      <p className="px-1 text-[12px] text-muted">
        Scans are saved on this device first, so nothing is lost if the signal drops.
      </p>

      <OnAPhoneHint />
    </div>
  );
}

/**
 * Shown only on a desktop-width window. Someone reaching the scanner from the
 * Inventory screen is almost certainly at a desk, and the thing they need is
 * the address to open on the handset that will actually do the scanning — the
 * camera is unavailable to them here anyway.
 */
function OnAPhoneHint(): React.JSX.Element {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="hidden rounded-lg border border-line bg-white p-3 md:block">
      <p className="text-[13px] font-medium">Using this on a phone</p>
      <p className="mt-1 text-[12px] text-muted">
        Open <span className="font-mono">{origin || '…'}/scan</span> on the handset and add it
        to the home screen. It then opens full-screen and keeps working without a signal.
      </p>
    </div>
  );
}
