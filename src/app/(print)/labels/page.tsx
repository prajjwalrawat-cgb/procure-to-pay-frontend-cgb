'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { Barcode128, QrMark } from '@/components/labels/label-marks';
import { useBoxes } from '@/lib/api/box';
import { useLocations, useProducts } from '@/lib/api/inventory';
import { Button, Skeleton, cn, controlClass } from '@/components/ui';

type Source = 'location' | 'box' | 'product';
type Format = 'barcode' | 'qr';

interface LabelRow {
  key: string;
  /** The value encoded in the mark — exactly what the scanner will read. */
  code: string;
  /** Human context printed alongside, e.g. "Rack A › Section A1". */
  title: string;
  subtitle: string;
}

/**
 * Printable label sheet.
 *
 * This is the step that turns a barcode *value* in the database into something
 * a camera can actually read. A section called "BIN-A1" has no barcode in the
 * world until somebody prints one and sticks it on the rack — until then the
 * operator has to type it, which is exactly what a scanner is meant to avoid.
 *
 * Every label prints the code in plain text underneath the mark. That is not
 * decoration: labels get scuffed, wet and torn, and when one stops scanning the
 * operator needs to be able to read it and type it into the manual-entry field.
 */
export default function PrintLabelsPage(): React.JSX.Element {
  // `useSearchParams` opts the subtree out of prerendering, so it has to sit
  // behind a Suspense boundary or the build fails outright.
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="mx-auto flex max-w-5xl flex-col gap-3 p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-14 w-full" />
        </div>
      }
    >
      <LabelSheet />
    </Suspense>
  );
}

function LabelSheet(): React.JSX.Element {
  const params = useSearchParams();
  const initial = (params.get('type') as Source | null) ?? 'location';

  const [source, setSource] = useState<Source>(initial);
  const [format, setFormat] = useState<Format>(initial === 'box' ? 'qr' : 'barcode');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const locations = useLocations();
  const boxes = useBoxes();
  // Only products that still have no barcode need a label printed: anything
  // carrying a manufacturer EAN is already scannable off the pack, and printing
  // a second code for it invites two labels that disagree.
  const products = useProducts({ limit: 200 });

  const rows: LabelRow[] = useMemo(() => {
    if (source === 'product') {
      return (products.data?.items ?? [])
        .filter((p) => !p.barcode)
        .map((p) => ({
          key: p.id,
          // The product's own code. The scanner resolves it as an exact SKU-code
          // match, so a printed label works without also writing it to the
          // barcode field.
          code: p.code,
          title: p.name,
          subtitle: p.colour ?? p.category,
        }));
    }
    if (source === 'box') {
      return (boxes.data?.items ?? []).map((b) => ({
        key: b.id,
        code: b.barcode,
        title: b.code,
        subtitle: b.locationName ?? 'Not placed',
      }));
    }
    // Only locations that actually carry a barcode can be labelled — printing a
    // sticker for a location with no code would produce a label that resolves
    // to nothing.
    return (locations.data?.items ?? [])
      .filter((l) => !!l.barcode)
      .map((l) => ({
        key: l.id,
        code: l.barcode as string,
        title: l.name,
        subtitle: l.parentName ? `in ${l.parentName}` : (l.kind ?? ''),
      }));
  }, [source, boxes.data, locations.data, products.data]);

  const chosen = rows.filter((r) => selected.has(r.key));
  const loading =
    source === 'box'
      ? boxes.isLoading
      : source === 'product'
        ? products.isLoading
        : locations.isLoading;

  function toggle(key: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Controls: on screen only. `print:hidden` keeps them off the paper. */}
      <div className="print:hidden">
        <h1 className="text-h1 font-semibold text-ink">Print labels</h1>
        <p className="mt-1 text-body-sm text-muted">
          Print onto sticker sheets, then put each label on the shelf or box it names.
          Until a label exists physically, that code can only be typed.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-line p-3">
          <label className="flex items-center gap-2 text-body-sm">
            <span className="text-muted">Labels for</span>
            <select
              className={cn(controlClass, 'w-auto pr-8')}
              value={source}
              onChange={(e) => {
                setSource(e.target.value as Source);
                setSelected(new Set());
              }}
            >
              <option value="location">Shelves / sections</option>
              <option value="box">Boxes</option>
              <option value="product">Products without a barcode</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-body-sm">
            <span className="text-muted">Format</span>
            <select
              className={cn(controlClass, 'w-auto pr-8')}
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
            >
              <option value="barcode">Barcode (Code 128) — fits a shelf edge</option>
              <option value="qr">QR — reads at an angle, better on boxes</option>
            </select>
          </label>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setSelected(
                selected.size === rows.length
                  ? new Set()
                  : new Set(rows.map((r) => r.key)),
              )
            }
          >
            {selected.size === rows.length && rows.length > 0
              ? 'Clear all'
              : 'Select all'}
          </Button>

          <Button
            type="button"
            variant="primary"
            className="sm:ml-auto"
            disabled={chosen.length === 0}
            onClick={() => window.print()}
          >
            Print{' '}
            {chosen.length > 0
              ? `${chosen.length} label${chosen.length === 1 ? '' : 's'}`
              : ''}
          </Button>
        </div>

        <div className="mt-4 space-y-1">
          {loading ? (
            <div aria-busy="true" className="space-y-1">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {!loading && rows.length === 0 ? (
            <p className="rounded border border-line px-3 py-6 text-center text-body-sm text-muted">
              {source === 'location'
                ? 'No shelves have a barcode yet. Add one on Inventory → Locations first.'
                : source === 'product'
                  ? 'Every product already carries a barcode — nothing here needs a printed label.'
                  : 'No boxes registered yet. Add one on Inventory → Boxes first.'}
            </p>
          ) : null}
          {rows.map((r) => (
            <label
              key={r.key}
              className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded border border-line px-3 py-2 text-body-sm hover:bg-canvas"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--accent)]"
                checked={selected.has(r.key)}
                onChange={() => toggle(r.key)}
              />
              <span className="font-medium">{r.title}</span>
              <span className="font-numeric text-caption text-muted">{r.code}</span>
              <span className="ml-auto text-caption text-muted">{r.subtitle}</span>
            </label>
          ))}
        </div>
      </div>

      {/* The sheet itself. Hidden on screen until something is selected so the
          page does not look like a wall of stickers before you choose. */}
      {chosen.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 print:mt-0 print:grid-cols-3 print:gap-2">
          {chosen.map((r) => (
            <div
              key={r.key}
              className="flex break-inside-avoid flex-col items-center justify-center rounded border border-line p-3 text-center print:border-line"
            >
              {format === 'qr' ? (
                <QrMark value={r.code} size={104} />
              ) : (
                <Barcode128 value={r.code} />
              )}
              {/* Always printed: a damaged label still has to be usable by hand. */}
              <span className="mt-1 font-mono text-caption font-semibold">{r.code}</span>
              <span className="text-micro text-muted">{r.title}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
