'use client';

import { Button, PageHeader, Pill } from '@/components/ui';
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
  const { data, isLoading } = useLocations();
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
            <div className="flex items-center gap-2">
              {/* A barcode in this table is only a value until somebody prints it. */}
              <Link href="/labels?type=location" target="_blank">
                <Button variant="ghost" size="sm">
                  Print labels
                </Button>
              </Link>
              <Link href="/inventory">
                <Button variant="ghost" size="sm">
                  Stock overview
                </Button>
              </Link>
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
        <div className="grid grid-cols-3 gap-4">
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
        <div className="mt-4 flex items-center justify-between">
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
        <table className="w-full text-body-sm">
          <thead className="border-line border-b text-left text-caption text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">Barcode</th>
              <th className="px-3 py-2 font-medium">Inside</th>
              <th className="px-3 py-2 text-right font-medium">Products</th>
              <th className="px-3 py-2 text-right font-medium">Units on hand</th>
              <th className="w-40 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  No locations yet.
                </td>
              </tr>
            )}
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
        <td className="px-3 py-2">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td className="px-3 py-2">
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
        <td className="px-3 py-2">
          <TextInput
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="BIN-A1"
          />
        </td>
        <td colSpan={3} className="px-3 py-2 text-micro text-faint">
          Label an existing shelf here — the barcode is what the scanner reads during
          putaway, transfer and cycle count.
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            disabled={!name.trim() || busy}
            onClick={save}
            className="text-caption font-medium text-accent-2 hover:underline"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(l.name);
              setKind(l.kind);
              setBarcode(l.barcode ?? '');
              setEditing(false);
            }}
            className="ml-3 text-caption text-muted hover:underline"
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2 text-ink">
        {l.name}
        {!l.active && (
          <Pill variant="gray" className="ml-1.5">
            Retired
          </Pill>
        )}
      </td>
      <td className="px-3 py-2 text-caption text-muted">{KIND_LABEL[l.kind]}</td>
      <td className="px-3 py-2 font-mono text-caption text-muted">{l.barcode ?? '—'}</td>
      <td className="px-3 py-2 text-caption text-muted">{l.parentName ?? '—'}</td>
      <td className="font-numeric px-3 py-2 text-right text-text">{l.productCount}</td>
      <td className="font-numeric px-3 py-2 text-right font-medium text-ink">
        {l.totalQty.toLocaleString('en-IN')}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-caption font-medium text-accent-2 hover:underline"
        >
          Rename
        </button>
        {l.active && (
          <button
            type="button"
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
            className="ml-3 text-caption text-muted hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            Retire
          </button>
        )}
      </td>
    </tr>
  );
}
