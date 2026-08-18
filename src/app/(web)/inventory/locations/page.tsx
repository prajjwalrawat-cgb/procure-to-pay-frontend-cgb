'use client';

import { Button, Pill } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import {
  useCreateLocation,
  useDeactivateLocation,
  useLocations,
  useUpdateLocation,
} from '@/lib/api/inventory';
import { Field, FormResult, SelectInput, TextInput } from '../_components/form-controls';

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
      });
      setSuccess(`Created "${name.trim()}".`);
      setName('');
      setRackNo('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the location');
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">Locations</h1>
          <p className="text-muted text-[13px]">
            {items.length} location{items.length === 1 ? '' : 's'} · rooms, racks and bins
          </p>
        </div>
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            Stock overview
          </Button>
        </Link>
      </div>

      {items.length === 0 && !isLoading && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-[12px] text-amber-800">
            No locations yet. Create at least one before receiving stock — every ledger
            movement records where the goods physically sit.
          </p>
        </div>
      )}

      <div className="border-line bg-panel mb-6 rounded-lg border p-4">
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
                  {l.rackNo ? ` · ${l.rackNo}` : ''}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <FormResult error={error} success={success} />
          <Button
            variant="accent"
            size="sm"
            disabled={!name.trim() || create.isPending}
            onClick={() => void submit()}
          >
            {create.isPending ? 'Creating…' : 'Add location'}
          </Button>
        </div>
      </div>

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Rack no.</th>
              <th className="px-3 py-2 font-medium">Inside</th>
              <th className="px-3 py-2 text-right font-medium">Products</th>
              <th className="px-3 py-2 text-right font-medium">Units on hand</th>
              <th className="w-40 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-muted px-3 py-8 text-center">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted px-3 py-8 text-center">
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
    active: boolean;
    productCount: number;
    totalQty: number;
  };
  onError: (m: string | null) => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(l.name);
  const [rackNo, setRackNo] = useState(l.rackNo ?? '');

  const update = useUpdateLocation();
  const deactivate = useDeactivateLocation();
  const busy = update.isPending || deactivate.isPending;

  function save(): void {
    onError(null);
    update.mutate(
      { id: l.id, name: name.trim(), rackNo: rackNo.trim() || null },
      { onError: (e) => onError(e.message), onSuccess: () => setEditing(false) },
    );
  }

  if (editing) {
    return (
      <tr className="border-line bg-canvas/50 border-t">
        <td className="px-3 py-2">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td className="px-3 py-2">
          <TextInput
            value={rackNo}
            onChange={(e) => setRackNo(e.target.value)}
            placeholder="(none)"
          />
        </td>
        <td colSpan={3} className="text-faint px-3 py-2 text-[11px]">
          Name is the place (Store, Conference Room). Rack no. is the shelf or
          carton inside it.
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            disabled={!name.trim() || busy}
            onClick={save}
            className="text-accent-2 text-[12px] font-medium hover:underline"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(l.name);
              setRackNo(l.rackNo ?? '');
              setEditing(false);
            }}
            className="text-muted ml-3 text-[12px] hover:underline"
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-line border-t">
      <td className="text-ink px-3 py-2">
        {l.name}
        {!l.active && (
          <Pill variant="gray" className="ml-1.5">
            Retired
          </Pill>
        )}
      </td>
      <td className="text-muted px-3 py-2">{l.rackNo ?? '—'}</td>
      <td className="text-muted px-3 py-2 text-[12px]">{l.parentName ?? '—'}</td>
      <td className="font-numeric text-text px-3 py-2 text-right">{l.productCount}</td>
      <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
        {l.totalQty.toLocaleString('en-IN')}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-accent-2 text-[12px] font-medium hover:underline"
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
            className="text-muted ml-3 text-[12px] hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            Retire
          </button>
        )}
      </td>
    </tr>
  );
}
