'use client';

import { Button, Pill } from '@/components/ui';
import { ISSUE_DEPT } from '@/lib/shared';
import Link from 'next/link';
import { useState } from 'react';

import { useCreateIssue, useLedger, useReturnIssue } from '@/lib/api/inventory';
import {
  Field,
  FormResult,
  LocationSelect,
  ProductSelect,
  SelectInput,
  TextArea,
  TextInput,
} from '../_components/form-controls';

/**
 * Internal issue — stock out to the photoshoot team, a sales person or another
 * place/person, plus the open-issues board with balance tracking and returns.
 *
 * The balance shown is derived from the linked return entries, not a stored
 * counter, so it cannot drift across partial returns.
 */
export default function IssuesPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Internal issues
          </h1>
          <p className="text-muted text-[13px]">
            Photoshoot · Sales · Other — issue, track balance, receive returns
          </p>
        </div>
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            Stock overview
          </Button>
        </Link>
      </div>

      <IssueForm />
      <OpenIssuesBoard />
    </div>
  );
}

function IssueForm(): React.JSX.Element {
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('');
  const [issueDept, setIssueDept] = useState<(typeof ISSUE_DEPT)[number]>('PHOTOSHOOT');
  const [issuedToName, setIssuedToName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [approvedById, setApprovedById] = useState('');
  const [tentativeReturnDate, setTentativeReturnDate] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const issue = useCreateIssue();

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      const res = await issue.mutateAsync({
        productId,
        locationId,
        qty: Number(qty),
        issueDept,
        issuedToName,
        customerName: customerName || null,
        approvedById: approvedById || null,
        tentativeReturnDate: tentativeReturnDate
          ? new Date(tentativeReturnDate).toISOString()
          : null,
        remark: remark || null,
      });
      setSuccess(`Issued (${res.id}).`);
      setQty('');
      setRemark('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the issue');
    }
  }

  const ready = productId && locationId && Number(qty) > 0 && issuedToName;

  return (
    <div className="border-line bg-panel mb-6 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Product" required>
            <ProductSelect
              value={productId}
              onChange={setProductId}
              search={search}
              onSearchChange={setSearch}
            />
          </Field>
        </div>

        <Field label="Issue from location" required>
          <LocationSelect value={locationId} onChange={setLocationId} />
        </Field>
        <Field label="Quantity" required>
          <TextInput
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>

        <Field label="Department" required>
          <SelectInput
            value={issueDept}
            onChange={(e) => setIssueDept(e.target.value as (typeof ISSUE_DEPT)[number])}
          >
            {ISSUE_DEPT.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Issued to" required hint="Team member, sales person or place.">
          <TextInput
            value={issuedToName}
            onChange={(e) => setIssuedToName(e.target.value)}
          />
        </Field>

        {issueDept === 'SALES' && (
          <Field label="Client name">
            <TextInput
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </Field>
        )}
        <Field
          label="Approved by"
          hint="Required above the tenant quantity or value threshold."
        >
          <TextInput
            value={approvedById}
            onChange={(e) => setApprovedById(e.target.value)}
            placeholder="usr_01H…"
          />
        </Field>
        <Field label="Expected return date">
          <TextInput
            type="date"
            value={tentativeReturnDate}
            onChange={(e) => setTentativeReturnDate(e.target.value)}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Remark">
            <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <FormResult error={error} success={success} />
        <Button
          variant="accent"
          size="sm"
          disabled={!ready || issue.isPending}
          onClick={() => void submit()}
        >
          {issue.isPending ? 'Issuing…' : 'Issue stock'}
        </Button>
      </div>
    </div>
  );
}

function OpenIssuesBoard(): React.JSX.Element {
  const { data, isLoading } = useLedger({ openOnly: true, limit: 100 });
  const [error, setError] = useState<string | null>(null);
  const rows = data?.items ?? [];

  return (
    <section>
      <h2 className="text-faint mb-2 text-[11px] font-medium uppercase tracking-wide">
        Open issues ({rows.length})
      </h2>
      {error && <p className="mb-2 text-[12px] text-red-600">{error}</p>}
      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 font-medium">Issued</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Dept</th>
              <th className="px-3 py-2 font-medium">Person / place</th>
              <th className="px-3 py-2 text-right font-medium">Issued</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
              <th className="w-56 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-muted px-3 py-8 text-center">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted px-3 py-8 text-center">
                  No open issues — everything has come back.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <OpenIssueRow key={r.id} row={r} onError={setError} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OpenIssueRow({
  row,
  onError,
}: {
  row: {
    id: string;
    txnDate: string;
    productName: string;
    productCode: string;
    issueDept: string | null;
    issuedToName: string | null;
    qty: number;
    balanceQty: number | null;
    tentativeReturnDate: string | null;
  };
  onError: (m: string | null) => void;
}): React.JSX.Element {
  const [qty, setQty] = useState('');
  const ret = useReturnIssue();
  const balance = row.balanceQty ?? 0;
  const overdue =
    row.tentativeReturnDate !== null && new Date(row.tentativeReturnDate) < new Date();

  return (
    <tr className="border-line border-t">
      <td className="font-numeric text-muted px-3 py-2 text-[12px]">
        {new Date(row.txnDate).toLocaleDateString('en-IN')}
        {overdue && (
          <Pill variant="danger" className="ml-1.5">
            Overdue
          </Pill>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="text-ink">{row.productName}</div>
        <div className="font-numeric text-faint text-[11px]">{row.productCode}</div>
      </td>
      <td className="px-3 py-2">
        <Pill variant="info">{row.issueDept ?? '—'}</Pill>
      </td>
      <td className="text-text px-3 py-2 text-[12px]">{row.issuedToName ?? '—'}</td>
      <td className="font-numeric text-muted px-3 py-2 text-right">{row.qty}</td>
      <td className="font-numeric px-3 py-2 text-right font-medium text-amber-700">
        {balance}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1.5">
          <input
            type="number"
            min={1}
            max={balance}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={String(balance)}
            className="border-line bg-panel text-text w-20 rounded-md border px-2 py-1 text-[12px] outline-none"
          />
          <button
            type="button"
            disabled={ret.isPending}
            onClick={() => {
              onError(null);
              ret.mutate(
                { id: row.id, qty: Number(qty || balance) },
                { onError: (e) => onError(e.message), onSuccess: () => setQty('') },
              );
            }}
            className="text-accent-2 text-[12px] font-medium hover:underline"
          >
            Return
          </button>
        </div>
      </td>
    </tr>
  );
}
