'use client';

import { Button, PageHeader, Pill, TableState, cn, controlClass } from '@/components/ui';
import { ISSUE_DEPT } from '@/lib/shared';
import Link from 'next/link';
import { useState } from 'react';

import { useCreateIssue, useLedger, useReturnIssue } from '@/lib/api/inventory';
import { useTeam } from '@/lib/api/users';
import {
  Field,
  FormResult,
  LocationSelect,
  ProductSelect,
  SelectInput,
  TextArea,
  TextInput,
} from '../_components/form-controls';
import { formatDate, humanise } from '@/lib/format';

/**
 * Internal issue — stock out to the photoshoot team, a sales person or another
 * place/person, plus the open-issues board with balance tracking and returns.
 *
 * The balance shown is derived from the linked return entries, not a stored
 * counter, so it cannot drift across partial returns.
 */
export default function IssuesPage(): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title="Internal issues"
        description="Issue stock to a team, track the outstanding balance, and receive returns."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/inventory">Stock overview</Link>
          </Button>
        }
      />

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
  const approvers = (useTeam().data ?? []).filter((u) => u.isActive);

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
    <div className="mb-6 rounded-lg border border-line bg-panel p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
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
                {humanise(d)}
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
          {/* A named list where the caller may read the team; otherwise the
              raw user id is still accepted so the issue is never blocked. */}
          {approvers.length > 0 ? (
            <SelectInput
              value={approvedById}
              onChange={(e) => setApprovedById(e.target.value)}
            >
              <option value="">Not needed</option>
              {approvers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </SelectInput>
          ) : (
            <TextInput
              value={approvedById}
              onChange={(e) => setApprovedById(e.target.value)}
              placeholder="Approver user id"
            />
          )}
        </Field>
        <Field label="Expected return date">
          <TextInput
            type="date"
            value={tentativeReturnDate}
            onChange={(e) => setTentativeReturnDate(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Remark">
            <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <FormResult error={error} success={success} />
        <Button
          variant="primary"
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
  const {
    data,
    isLoading,
    error: loadError,
    refetch,
  } = useLedger({ openOnly: true, limit: 100 });
  const [error, setError] = useState<string | null>(null);
  const rows = data?.items ?? [];

  return (
    <section>
      <h2 className="mb-3 text-h3 font-semibold text-ink">Open issues ({rows.length})</h2>
      {error && <p className="mb-2 text-caption text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-b border-line text-left text-caption text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">Issued on</th>
              <th className="px-3 py-2.5 font-medium">Product</th>
              <th className="px-3 py-2.5 font-medium">Dept</th>
              <th className="px-3 py-2.5 font-medium">Person / place</th>
              <th className="px-3 py-2.5 text-right font-medium">Qty issued</th>
              <th className="px-3 py-2.5 text-right font-medium">Balance</th>
              {/* Labelled for the stacked mobile card; visually the column speaks for itself. */}
              <th className="w-56 px-3 py-2.5 text-right font-medium">
                <span className="sr-only">Return</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={7}
              isLoading={isLoading}
              error={loadError}
              onRetry={() => void refetch()}
              isEmpty={rows.length === 0}
              empty="No open issues — everything has come back"
            />
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
    <tr className="border-t border-line">
      <td className="font-numeric px-3 py-3.5 text-caption text-muted">
        {formatDate(row.txnDate)}
        {overdue && (
          <Pill variant="danger" className="ml-1.5">
            Overdue
          </Pill>
        )}
      </td>
      <td className="px-3 py-3.5">
        <div className="text-ink">{row.productName}</div>
        <div className="font-numeric text-micro text-faint">{row.productCode}</div>
      </td>
      <td className="px-3 py-3.5">
        {/* A department is a fact about the issue, not a state it moves through. */}
        <span className="text-caption text-text">
          {row.issueDept ? humanise(row.issueDept) : '—'}
        </span>
      </td>
      <td className="px-3 py-3.5 text-caption text-text">{row.issuedToName ?? '—'}</td>
      <td className="font-numeric px-3 py-3.5 text-right text-muted">{row.qty}</td>
      <td className="font-numeric px-3 py-3.5 text-right font-medium text-warn">
        {balance}
      </td>
      <td className="px-3 py-3.5">
        <div className="flex items-center justify-end gap-1.5">
          <input
            type="number"
            min={1}
            max={balance}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={String(balance)}
            aria-label={`Quantity to return, up to ${balance}`}
            className={cn(controlClass, 'h-8 w-20 py-1')}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={ret.isPending}
            onClick={() => {
              onError(null);
              ret.mutate(
                { id: row.id, qty: Number(qty || balance) },
                { onError: (e) => onError(e.message), onSuccess: () => setQty('') },
              );
            }}
          >
            Return
          </Button>
        </div>
      </td>
    </tr>
  );
}
