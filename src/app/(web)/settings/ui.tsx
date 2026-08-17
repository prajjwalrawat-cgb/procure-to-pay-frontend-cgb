'use client';

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
          <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
          <p className="text-[12px] text-muted">{hint}</p>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-[11px] text-faint">{hint}</span>
      )}
      {error && <span className="mt-1 block text-[11px] text-danger">{error}</span>}
    </label>
  );
}

export const selectCls =
  'border-line bg-panel text-text focus-visible:ring-accent h-9 w-full rounded-sm border px-3 text-[13px] outline-none focus-visible:ring-2';

export const textareaCls =
  'border-line bg-panel text-text focus-visible:ring-accent w-full rounded-sm border px-3 py-2 text-[13px] outline-none focus-visible:ring-2';
