'use client';

import { ErrorState, Skeleton, cn, controlClass } from '@/components/ui';

/** Shared chrome for the settings sections — one card per topic, matching the
 *  left-nav layout of the page. */
export function Panel({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="mb-4 rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h3 font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-caption text-muted">{hint}</p>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * A labelled settings field.
 *
 * Capped at a reading measure rather than filling the panel. The settings
 * content column is ~900px wide, and a `w-full` input in it rendered a
 * ten-character PAN field nearly a metre across — which is both hard to scan
 * and why the panels read as mostly empty space. A form field should be about
 * as wide as the value it holds.
 *
 * `wide` opts a field out for the ones that genuinely need the room: a
 * multi-line address, a comma-separated list.
 */
export function Field({
  label,
  error,
  hint,
  wide,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className={wide ? 'block' : 'block max-w-md'}>
      <span className="mb-1 block text-caption text-muted">{label}</span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-micro text-faint">{hint}</span>
      )}
      {error && <span className="mt-1 block text-micro text-danger">{error}</span>}
    </label>
  );
}

// One control definition for the whole app — see components/ui/components/input.tsx.
export const selectCls = controlClass;
export const textareaCls = cn(controlClass, 'min-h-[72px]');

/**
 * What a section shows before its data arrives: a panel-shaped skeleton, or
 * the error with a retry. A bare "Loading…" never resolved when the fetch
 * failed, so a 403 or a dropped connection read as an endless load.
 */
export function SectionLoading({
  error,
  onRetry,
}: {
  error?: unknown;
  onRetry?: () => void;
}): React.JSX.Element {
  if (error) {
    return (
      <section className="mb-4 rounded-lg border border-line bg-panel">
        <ErrorState error={error} onRetry={onRetry} compact />
      </section>
    );
  }
  return (
    <section
      className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-panel p-4"
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-72 max-w-full" />
      <Skeleton className="mt-2 h-9 w-full max-w-md" />
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-9 w-full max-w-md" />
    </section>
  );
}
