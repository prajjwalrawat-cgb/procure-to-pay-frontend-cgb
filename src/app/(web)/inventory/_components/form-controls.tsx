'use client';

import { useProduct, useProducts, useLocations } from '@/lib/api/inventory';
import { ProductThumb } from './product-thumb';

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
 *
 * The chosen product is echoed back in a confirmation strip below the list. A
 * multi-row <select> greys its highlight the moment focus moves elsewhere, so
 * the highlight alone left people unsure whether the click had registered.
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
      <SelectedProduct productId={value} onClear={() => onChange('')} />
    </div>
  );
}

/** Unambiguous "this is what you picked" strip under the product list. */
function SelectedProduct({
  productId,
  onClear,
}: {
  productId: string;
  onClear: () => void;
}): React.JSX.Element {
  const { data, isLoading } = useProduct(productId || null);

  if (!productId) {
    return (
      <p className="text-faint text-[11px]">
        No product selected — pick one from the list above.
      </p>
    );
  }

  return (
    <div className="border-accent/40 bg-canvas flex items-center gap-2.5 rounded-md border px-2.5 py-2">
      <ProductThumb url={data?.imageUrl ?? null} alt={data?.name ?? ''} size={28} />
      <div className="min-w-0 flex-1">
        <div className="text-ink truncate text-[13px] font-medium">
          {isLoading ? 'Loading…' : data?.name}
          {data?.colour ? <span className="text-muted"> · {data.colour}</span> : null}
        </div>
        <div className="font-numeric text-faint text-[11px]">
          {data?.code}
          {data ? ` · ${data.currentStock.toLocaleString('en-IN')} on hand` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-muted hover:text-ink shrink-0 text-[12px]"
      >
        Clear
      </button>
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
