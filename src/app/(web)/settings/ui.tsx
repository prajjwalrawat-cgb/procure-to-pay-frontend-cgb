'use client';

import { cn, controlClass } from '@/components/ui';

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
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-body font-semibold text-ink">{title}</h2>
          <p className="text-caption text-muted">{hint}</p>
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
