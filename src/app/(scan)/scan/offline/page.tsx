import Link from 'next/link';

/**
 * The service worker's navigation fallback. Deliberately reassuring rather than
 * apologetic: an operator who reaches this page has probably just walked into a
 * dead spot mid-task, and the thing they need to know is that their scans are
 * safe on the handset.
 */
export default function ScanOfflinePage(): React.JSX.Element {
  return (
    <div className="space-y-4 py-8 text-center">
      <h1 className="text-h2 font-semibold">No signal</h1>
      <p className="mx-auto max-w-xs text-body text-muted">
        Everything you scanned is saved on this device and will sync by itself once you
        are back in range. You can keep scanning.
      </p>
      <Link
        href="/scan"
        className="inline-block rounded-md border border-line bg-panel px-4 py-3 text-body"
      >
        Back to tasks
      </Link>
    </div>
  );
}
