'use client';

import { useProducts, useLocations } from '@/lib/api/inventory';

/** Labelled field wrapper — keeps every inventory form visually consistent. */
export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted text-[12px] font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && <span className="text-faint text-[11px]">{hint}</span>}
    </label>
  );
}

const INPUT_CLASS =
  'border-line bg-panel text-text placeholder:text-faint focus:border-accent rounded-md border px-3 py-1.5 text-[13px] outline-none';

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
): React.JSX.Element {
  return <input {...props} className={INPUT_CLASS} />;
}

export function SelectInput(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
): React.JSX.Element {
  return <select {...props} className={INPUT_CLASS} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
): React.JSX.Element {
  return <textarea {...props} className={INPUT_CLASS} rows={2} />;
}

/**
 * Product picker. Searches the catalogue rather than listing all 625 SKUs, and
 * shows the code + colour so near-identical names stay distinguishable.
 */
export function ProductSelect({
  value,
  onChange,
  search,
  onSearchChange,
}: {
  value: string;
  onChange: (id: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
}): React.JSX.Element {
  const { data } = useProducts({ q: search || undefined, active: true, limit: 50 });
  return (
    <div className="flex flex-col gap-1.5">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search product…"
        className={INPUT_CLASS}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
        size={5}
      >
        <option value="">— choose a product —</option>
        {(data?.items ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.colour ? ` · ${p.colour}` : ''} ({p.code}) — {p.currentStock} on hand
          </option>
        ))}
      </select>
    </div>
  );
}

export function LocationSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}): React.JSX.Element {
  const { data } = useLocations();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASS}
    >
      <option value="">— choose a location —</option>
      {(data?.items ?? []).map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
          {l.rackNo ? ` · ${l.rackNo}` : ''}
        </option>
      ))}
    </select>
  );
}

/** Consistent success/error strip under a submit button. */
export function FormResult({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}): React.JSX.Element | null {
  if (error) return <p className="text-[12px] text-red-600">{error}</p>;
  if (success) return <p className="text-[12px] text-emerald-700">{success}</p>;
  return null;
}
