'use client';

import { Button, PageHeader, Pill, SortableHead, TableState, useSort } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useBoxes } from '@/lib/api/box';
import { useLocations } from '@/lib/api/inventory';
import { apiFetch } from '@/lib/api-client';
import { Field, FormResult, SelectInput, TextInput } from '../_components/form-controls';

/**
 * Boxes — the physical cartons stock sits in, registered here and filled on the
 * floor with the scanner.
 *
 * A box is not a location. Locations are fixed places (warehouse → rack →
 * section); a box travels between them, taking its contents with it. So a box
 * has a *current* section rather than being a level of the hierarchy.
 *
 * Contents are not editable here on purpose: stock moves into and out of a box
 * through scans, which write ledger entries. Typing a quantity into a form would
 * create stock that no movement accounts for.
 */
export default function BoxesPage(): React.JSX.Element {
  const locations = useLocations();
  const { data, isLoading, refetch, isError, error: loadError } = useBoxes();

  const [barcode, setBarcode] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const items = data?.items ?? [];
  const { sorted, sort, toggle } = useSort(items, {
    code: (b) => b.code,
    location: (b) => b.locationName,
    products: (b) => b.distinctProducts,
    units: (b) => Number(b.totalQty),
  });
  // Only sections hold boxes — a box does not sit "in a warehouse", it sits on
  // a specific shelf. Older unclassified locations stay selectable so a tenant
  // that has not labelled its tree yet is not locked out.
  const sections = (locations.data?.items ?? []).filter(
    (l) => l.kind === 'SECTION' || l.kind === 'OTHER' || l.kind === 'DOCK',
  );

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    setCreating(true);
    try {
      const created = await apiFetch<{ code: string }>('/boxes', {
        method: 'POST',
        body: JSON.stringify({
          barcode: barcode.trim() || null,
          locationId: locationId || null,
          notes: notes.trim() || null,
        }),
      });
      setSuccess(
        `Registered ${created.code}. Print its label to make it scannable — until then the code has to be typed.`,
      );
      setBarcode('');
      setNotes('');
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register the box');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Boxes"
        description={
          <>
            {isError || isLoading
              ? 'Cartons stock sits in. Scan one on the handset to see what is inside.'
              : `${items.length} box${items.length === 1 ? '' : 'es'}, scan one on the handset to see what is inside`}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/labels?type=box" target="_blank">
                Print labels
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/scan/box">Open scanner</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-h3 font-semibold text-ink">Register a box</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Barcode"
            hint="Leave blank to let the server allocate one (BOX-000123)."
          >
            <TextInput
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="pre-printed label, or blank"
            />
          </Field>
          <Field label="Sits in" hint="Which section the box starts on. Optional.">
            <SelectInput
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">— not placed yet —</option>
              {sections.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Notes">
            <TextInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Fragile — top shelf only"
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <FormResult error={error} success={success} />
          <Button
            variant="primary"
            size="sm"
            disabled={creating}
            onClick={() => void submit()}
          >
            {creating ? 'Registering…' : 'Register box'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left text-caption text-muted">
            <tr>
              <SortableHead label="Box" sortKey="code" sort={sort} onSort={toggle} />
              <th className="px-3 py-2.5 font-medium">Barcode</th>
              <SortableHead label="Sits in" sortKey="location" sort={sort} onSort={toggle} />
              <SortableHead label="Products" sortKey="products" sort={sort} onSort={toggle} numeric />
              <SortableHead label="Units inside" sortKey="units" sort={sort} onSort={toggle} numeric />
            </tr>
          </thead>
          <tbody>
            {/* A failed load must never read as "no boxes". An empty table is a
                statement of fact about the warehouse; if the request did not
                come back, we do not know that fact and must not imply it. */}
            <TableState
              colSpan={5}
              isLoading={isLoading}
              error={isError ? loadError : null}
              onRetry={() => void refetch()}
              isEmpty={items.length === 0}
              empty={{
                title: 'No boxes yet',
                detail: 'Register one above, then fill it from the scanner.',
              }}
            />
            {sorted.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="px-3 py-3.5 font-medium text-ink">{b.code}</td>
                <td className="font-numeric px-3 py-3.5 text-caption text-muted">
                  {b.barcode}
                </td>
                <td className="px-3 py-3.5 text-muted">
                  {b.locationName ?? <Pill variant="neutral">Not placed</Pill>}
                </td>
                <td className="font-numeric px-3 py-3.5 text-right">
                  {b.distinctProducts}
                </td>
                <td className="font-numeric px-3 py-3.5 text-right">{b.totalQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
