'use client';

import type { ScanProductView, ScanResolveResponse } from '@/lib/shared';

/**
 * The small, shared pieces every scan screen needs. Kept together because they
 * exist to make five screens behave identically: same touch targets, same way
 * of admitting a fuzzy match, same way of reporting a queued scan.
 */

/** A large numeric field. `inputMode` gives a phone its number pad. */
export function QtyField({
  value,
  onChange,
  label = 'Quantity',
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="text-caption text-muted">{label}</span>
      <input
        className="w-full rounded-md border border-line px-3 py-3 text-h2 tabular-nums outline-none focus:border-accent"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      />
    </label>
  );
}

export function TextField({
  value,
  onChange,
  label,
  placeholder,
  type = 'text',
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  type?: 'text' | 'date';
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="text-caption text-muted">{label}</span>
      <input
        // 16px keeps iOS from zooming the viewport when the field takes focus.
        className="w-full rounded-md border border-line px-3 py-3 text-h3 outline-none focus:border-accent"
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/**
 * The resolved product, shown before anything is submitted.
 *
 * A fuzzy GTIN match is labelled as such. The operator is the only one who can
 * confirm that the padded barcode on file is the box in their hand, and
 * presenting a guess with the same confidence as an exact hit is how the wrong
 * SKU ends up in an immutable ledger.
 */
export function ProductCard({
  resolved,
  children,
}: {
  resolved: ScanResolveResponse;
  children?: React.ReactNode;
}): React.JSX.Element {
  const p: ScanProductView = resolved.product;
  return (
    <section className="space-y-2 rounded-lg border border-line bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-h3 font-semibold">{p.name}</h2>
          <p className="text-caption text-muted">
            {p.code}
            {p.colour ? `, ${p.colour}` : ''}, on hand {p.currentStock} {p.unit}
          </p>
        </div>
        {resolved.matchType === 'fuzzy_gtin' ? (
          <span className="rounded bg-warn/15 px-2 py-1 text-micro font-medium text-warn">
            Close match — check
          </span>
        ) : null}
      </div>

      {p.requiresBatchTracking ? (
        <p className="rounded bg-accent/10 px-2 py-1 text-caption text-accent">
          Batch-tracked — batch number and expiry are required.
        </p>
      ) : null}

      {children}
    </section>
  );
}

/** Success, queued-offline and error all read the same way across screens. */
export function ResultBanner({
  tone,
  message,
}: {
  tone: 'ok' | 'queued' | 'error';
  message: string;
}): React.JSX.Element {
  const cls =
    tone === 'ok'
      ? 'bg-ok/15 text-ok'
      : tone === 'queued'
        ? 'bg-warn/15 text-warn'
        : 'bg-danger/15 text-danger';
  return (
    <p className={`rounded-md px-3 py-2 text-body-sm ${cls}`} role="status">
      {message}
    </p>
  );
}

/** The message shown when a scan went to the queue rather than the server. */
export const QUEUED_MESSAGE =
  'Saved on this device — it will sync automatically when you are back in signal.';
