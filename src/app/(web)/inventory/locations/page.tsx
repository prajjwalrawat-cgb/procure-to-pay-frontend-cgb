'use client';

import { Button, PageHeader, Pill, TableState } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import {
  useCreateLocation,
  useDeactivateLocation,
  useLocations,
  useUpdateLocation,
} from '@/lib/api/inventory';
import type { LocationKind } from '@/lib/shared';
import { Field, FormResult, SelectInput, TextInput } from '../_components/form-controls';

/** How each hierarchy level reads in the table. */
const KIND_LABEL: Record<LocationKind, string> = {
  WAREHOUSE: 'Warehouse',
  RACK: 'Rack',
  SECTION: 'Section',
  DOCK: 'Dock',
  OTHER: '—',
};

/**
 * Locations — the physical places stock sits. Every movement needs one, so this
 * is the first thing to set up on a fresh tenant.
 *
 * Locations can nest (room → rack → bin) via an optional parent. A location that
 * still holds stock cannot be retired; move or write the stock off first.
 */
export default function LocationsPage(): React.JSX.Element {
  const { data, isLoading, error: loadError, refetch } = useLocations();
  const create = useCreateLocation();

  const [name, setName] = useState('');
  const [rackNo, setRackNo] = useState('');
  const [parentId, setParentId] = useState('');
  const [kind, setKind] = useState<LocationKind>('OTHER');
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const items = data?.items ?? [];

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        rackNo: rackNo.trim() || null,
        parentId: parentId || null,
        kind,
        barcode: barcode.trim() || null,
      });
      setSuccess(`Created "${name.trim()}".`);
      setName('');
      setRackNo('');
      setBarcode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the location');
    }
  }

  return (
    <div>
      <PageHeader
        title="Locations"
        description={
          <>
            {items.length} location{items.length === 1 ? '' : 's'}, rooms, racks and bins
          </>
        }
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2">
              {/* A barcode in this table is only a value until somebody prints it. */}
              <Button asChild variant="ghost" size="sm">
                <Link href="/labels?type=location" target="_blank">
                  Print labels
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/inventory">Stock overview</Link>
              </Button>
            </div>
          </>
        }
      />

      {items.length === 0 && !isLoading && (
        <div className="mb-4 rounded-md border border-warn/40 bg-warn-bg px-3 py-2">
          <p className="text-caption text-warn">
            No locations yet. Create at least one before receiving stock — every ledger
            movement records where the goods physically sit.
          </p>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-line bg-panel p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" required>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Store"
            />
          </Field>
          <Field label="Rack no." hint="Optional — a rack, carton or shelf marker.">
            <TextInput
              value={rackNo}
              onChange={(e) => setRackNo(e.target.value)}
              placeholder="Rack-6"
            />
          </Field>
          <Field label="Parent location" hint="Optional nesting: room → rack → bin.">
            <SelectInput value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— none —</option>
              {items.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.rackNo ? `, ${l.rackNo}` : ''}
                </option>
              ))}
            </SelectInput>
          </Field>

          {/* Build the hierarchy by creating a Warehouse first, then Racks with
              it as parent, then Sections under each rack. The scanner reads
              these levels to show "Main Warehouse › Rack A › Section A1". */}
          <Field
            label="Level"
            hint="Warehouse → rack → section. Boxes go inside sections."
          >
            <SelectInput
              value={kind}
              onChange={(e) => setKind(e.target.value as LocationKind)}
            >
              <option value="WAREHOUSE">Warehouse</option>
              <option value="RACK">Rack</option>
              <option value="SECTION">Section / row</option>
              <option value="DOCK">Receiving dock</option>
              <option value="OTHER">Other / unclassified</option>
            </SelectInput>
          </Field>
          <Field
            label="Barcode"
            hint="The label stuck on this shelf. Needed for scanning; usually only on sections."
          >
            <TextInput
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="BIN-A1"
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <FormResult error={error} success={success} />
          <Button
            variant="primary"
            size="sm"
            disabled={!name.trim() || create.isPending}
            onClick={() => void submit()}
          >
            {create.isPending ? 'Creating…' : 'Add location'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-b border-line text-left text-caption text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">Location</th>
              <th className="px-3 py-2.5 font-medium">Level</th>
              <th className="px-3 py-2.5 font-medium">Barcode</th>
              <th className="px-3 py-2.5 font-medium">Inside</th>
              <th className="px-3 py-2.5 text-right font-medium">Products</th>
              <th className="px-3 py-2.5 text-right font-medium">Units on hand</th>
              <th className="w-40 px-3 py-2.5 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={7}
              isLoading={isLoading}
              error={loadError}
              onRetry={() => void refetch()}
              isEmpty={items.length === 0}
              empty="No locations yet"
            />
            {items.map((l) => (
              <LocationRow key={l.id} location={l} onError={setError} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * One location row, switchable into an inline edit. Retiring is refused
 * server-side while the location still holds stock, so the button is disabled
 * rather than failing after the click.
 */
function LocationRow({
  location: l,
  onError,
}: {
  location: {
    id: string;
    name: string;
    rackNo: string | null;
    parentName: string | null;
    barcode: string | null;
    kind: LocationKind;
    active: boolean;
    productCount: number;
    totalQty: number;
  };
  onError: (m: string | null) => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(l.name);
  const [kind, setKind] = useState<LocationKind>(l.kind);
  const [barcode, setBarcode] = useState(l.barcode ?? '');

  const update = useUpdateLocation();
  const deactivate = useDeactivateLocation();
  const busy = update.isPending || deactivate.isPending;

  function save(): void {
    onError(null);
    update.mutate(
      { id: l.id, name: name.trim(), kind, barcode: barcode.trim() || null },
      { onError: (e) => onError(e.message), onSuccess: () => setEditing(false) },
    );
  }

  if (editing) {
    return (
      <tr className="border-t border-line bg-canvas/50">
        <td className="px-3 py-3.5">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td className="px-3 py-3.5">
          <SelectInput
            value={kind}
            onChange={(e) => setKind(e.target.value as LocationKind)}
          >
            <option value="WAREHOUSE">Warehouse</option>
            <option value="RACK">Rack</option>
            <option value="SECTION">Section / row</option>
            <option value="DOCK">Dock</option>
            <option value="OTHER">Other</option>
          </SelectInput>
        </td>
        <td className="px-3 py-3.5">
          <TextInput
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="BIN-A1"
          />
        </td>
        <td colSpan={3} className="px-3 py-3.5 text-caption text-muted">
          Label an existing shelf here — the barcode is what the scanner reads during
          putaway, transfer and cycle count.
        </td>
        <td className="px-3 py-3.5 text-right">
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!name.trim() || busy}
              onClick={save}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setName(l.name);
                setKind(l.kind);
                setBarcode(l.barcode ?? '');
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-3.5 text-ink">
        {l.name}
        {!l.active && (
          <Pill variant="neutral" className="ml-1.5">
            Retired
          </Pill>
        )}
      </td>
      <td className="px-3 py-3.5 text-caption text-muted">{KIND_LABEL[l.kind]}</td>
      <td className="font-numeric px-3 py-3.5 text-caption text-muted">
        {l.barcode ?? '—'}
      </td>
      <td className="px-3 py-3.5 text-caption text-muted">{l.parentName ?? '—'}</td>
      <td className="font-numeric px-3 py-3.5 text-right text-text">{l.productCount}</td>
      <td className="font-numeric px-3 py-3.5 text-right font-medium text-ink">
        {l.totalQty.toLocaleString('en-IN')}
      </td>
      <td className="px-3 py-3.5 text-right">
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          {l.active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || l.totalQty !== 0}
              title={
                l.totalQty !== 0
                  ? 'Move or write off the stock here before retiring it'
                  : undefined
              }
              onClick={() => {
                onError(null);
                deactivate.mutate(l.id, { onError: (e) => onError(e.message) });
              }}
            >
              Retire
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
