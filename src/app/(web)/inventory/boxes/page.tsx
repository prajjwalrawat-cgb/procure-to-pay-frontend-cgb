'use client';

import { Button, PageHeader, Pill } from '@/components/ui';
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
            {isError
              ? 'Could not reach the server'
              : `${items.length} box${items.length === 1 ? '' : 'es'}, scan one on the handset to see what is inside`}
          </>
        }
        actions={
          <>
            <div className="flex items-center gap-2">
              <Link href="/labels?type=box" target="_blank">
                <Button variant="ghost" size="sm">
                  Print labels
                </Button>
              </Link>
              <Link href="/scan/box">
                <Button variant="ghost" size="sm">
                  Open scanner
                </Button>
              </Link>
            </div>
          </>
        }
      />

      <div className="mb-6 rounded-lg border border-line bg-panel p-4">
        <div className="grid grid-cols-3 gap-4">
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
        <div className="mt-4 flex items-center justify-between">
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
        <table className="w-full text-[13px]">
          <thead className="border-line border-b text-left text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Box</th>
              <th className="px-3 py-2 font-medium">Barcode</th>
              <th className="px-3 py-2 font-medium">Sits in</th>
              <th className="px-3 py-2 text-right font-medium">Products</th>
              <th className="px-3 py-2 text-right font-medium">Units inside</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {/* A failed load must never read as "no boxes". An empty table is a
                statement of fact about the warehouse; if the request did not
                come back, we do not know that fact and must not imply it. */}
            {!isLoading && isError && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-danger">
                  Could not load boxes:{' '}
                  {loadError instanceof Error ? loadError.message : 'request failed'}
                </td>
              </tr>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  No boxes yet. Register one above, then fill it from the scanner.
                </td>
              </tr>
            )}
            {items.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{b.code}</td>
                <td className="px-3 py-2 font-mono text-[12px] text-muted">
                  {b.barcode}
                </td>
                <td className="px-3 py-2 text-muted">
                  {b.locationName ?? <Pill variant="gray">Not placed</Pill>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.distinctProducts}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{b.totalQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
