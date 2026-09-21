'use client';

import { Combobox, controlClass } from '@/components/ui';
import { qty } from '@/lib/format';

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
      <span className="text-muted text-caption font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && <span className="text-faint text-micro">{hint}</span>}
    </label>
  );
}

// The shared control definition — see components/ui/components/input.tsx.
const INPUT_CLASS = controlClass;

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
 * Product picker.
 *
 * A searchable combobox rather than a native list. This selector is over the
 * whole catalogue — 600-odd SKUs, many with near-identical names separated
 * only by colour — and a `<select size={5}>` gave no way to type, greyed its
 * own highlight the moment focus left, and let two products differing by one
 * word sit adjacent with nothing to tell them apart. The code and colour ride
 * in the option's detail line, and the combobox filters on those too, so a
 * stores officer who knows the code finds the row with the code.
 *
 * The chosen product is still echoed back in a confirmation strip below, with
 * its image and stock on hand: "which one did I just pick" is worth answering
 * explicitly when the next step writes to the ledger.
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
  // `search` / `onSearchChange` stay in the API because the caller persists
  // the last query across steps; the combobox filters the fetched page itself.
  const { data } = useProducts({ q: search || undefined, active: true, limit: 50 });
  void onSearchChange;
  return (
    <div className="flex flex-col gap-1.5">
      <Combobox
        options={(data?.items ?? []).map((p) => ({
          value: p.id,
          label: p.colour ? `${p.name} — ${p.colour}` : p.name,
          detail: `${p.code}, ${p.currentStock} on hand`,
        }))}
        value={value}
        onChange={onChange}
        placeholder="Search the catalogue…"
        emptyText="No product matches that search"
      />
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
      <p className="text-faint text-micro">
        No product selected — pick one from the list above.
      </p>
    );
  }

  return (
    <div className="border-accent/40 bg-canvas flex items-center gap-2.5 rounded-md border px-2.5 py-2">
      <ProductThumb url={data?.imageUrl ?? null} alt={data?.name ?? ''} size={28} />
      <div className="min-w-0 flex-1">
        <div className="text-ink truncate text-body-sm font-medium">
          {isLoading ? 'Loading…' : data?.name}
          {data?.colour ? <span className="text-muted"> — {data.colour}</span> : null}
        </div>
        <div className="font-numeric text-faint text-micro">
          {data?.code}
          {data ? ` — ${qty(data.currentStock)} on hand` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-muted hover:text-ink shrink-0 text-caption"
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
    <Combobox
      options={(data?.items ?? []).map((l) => ({
        value: l.id,
        label: l.name,
        detail: l.rackNo ?? undefined,
      }))}
      value={value}
      onChange={onChange}
      placeholder="Search locations…"
      emptyText="No location matches that search"
    />
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
  if (error) return <p className="text-danger text-caption">{error}</p>;
  if (success) return <p className="text-success text-caption">{success}</p>;
  return null;
}
