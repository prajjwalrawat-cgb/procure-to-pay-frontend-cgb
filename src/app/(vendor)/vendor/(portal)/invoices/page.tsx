'use client';

import {
  Badge,
  Button,
  Input,
  PageHeader,
  Pill,
  Select,
  SortableHead,
  TableState,
  useSort,
} from '@/components/ui';
import { Money } from '@/lib/shared';
import { Download, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useMyInvoices, type VendorInvoiceSummary } from '@/vendor/lib/api/invoices';
import { downloadCsv } from '@/lib/csv';
import { formatDate, statusLabel, statusVariant } from '@/lib/format';

const fmtDate = (iso: string): string => formatDate(iso);
const inr = (v: string): string => Money.of(v || 0).toINR();

type SortKey = 'number' | 'ref' | 'date' | 'status' | 'amount';

export default function VendorInvoicesPage(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useMyInvoices();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const statuses = useMemo(
    () => [...new Set((data ?? []).map((i) => i.status))].sort(),
    [data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((i) => {
      if (status !== 'all' && i.status !== status) return false;
      if (!q) return true;
      return (
        i.number.toLowerCase().includes(q) || i.vendorInvoiceRef.toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);
  const { sorted, sort, toggle } = useSort<VendorInvoiceSummary, SortKey>(rows, {
    number: (i) => i.number,
    ref: (i) => i.vendorInvoiceRef,
    date: (i) => new Date(i.invoiceDate),
    status: (i) => statusLabel(i.status),
    amount: (i) => Number(i.grossAmount),
  });

  const total = useMemo(
    () => rows.reduce((acc, r) => acc.add(r.grossAmount || 0), Money.zero()),
    [rows],
  );
  const firstRun = (data?.length ?? 0) === 0;

  const exportCsv = (): void =>
    downloadCsv('my-invoices', sorted, [
      { header: 'Invoice', value: (r) => r.number },
      { header: 'Reference', value: (r) => r.vendorInvoiceRef },
      { header: 'Invoice date', value: (r) => fmtDate(r.invoiceDate) },
      { header: 'Status', value: (r) => statusLabel(r.status) },
      { header: 'Amount', value: (r) => r.grossAmount },
    ]);

  return (
    <div>
      <PageHeader
        title="My invoices"
        description="Invoices you have submitted and where each one stands."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              disabled={rows.length === 0}
            >
              <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/vendor/invoices/submit">Submit invoice</Link>
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            className="text-faint pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice or reference…"
            aria-label="Search invoices"
            className="w-full pl-8"
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-auto"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
        {!isLoading && !error && (
          <span className="text-muted ml-auto text-caption">
            {rows.length} shown · <span className="font-numeric">{inr(total.toString())}</span>
          </span>
        )}
      </div>

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left">
            <tr>
              <SortableHead label="Invoice" sortKey="number" sort={sort} onSort={toggle} />
              <SortableHead label="Reference" sortKey="ref" sort={sort} onSort={toggle} />
              <SortableHead label="Invoice date" sortKey="date" sort={sort} onSort={toggle} />
              <SortableHead label="Status" sortKey="status" sort={sort} onSort={toggle} />
              <SortableHead label="Amount" sortKey="amount" sort={sort} onSort={toggle} numeric />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={5}
              isLoading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              isEmpty={rows.length === 0}
              empty={
                firstRun
                  ? {
                      title: 'No invoices submitted yet',
                      detail: 'Submit an invoice against one of your purchase orders to start tracking it here.',
                      action: (
                        <Button asChild variant="secondary" size="sm">
                          <Link href="/vendor/invoices/submit">Submit invoice</Link>
                        </Button>
                      ),
                    }
                  : {
                      title: 'No invoices match your filters',
                      action: (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSearch('');
                            setStatus('all');
                          }}
                        >
                          Clear filters
                        </Button>
                      ),
                    }
              }
            />
            {!isLoading &&
              sorted.map((inv) => (
                <tr key={inv.id} className="border-line hover:bg-canvas border-b last:border-0">
                  <td className="font-numeric text-ink px-3 py-3 font-medium">{inv.number}</td>
                  <td className="text-muted px-3 py-3">
                    <span className="font-numeric">{inv.vendorInvoiceRef}</span>
                    {inv.proformaRef && (
                      <div className="text-faint text-micro">
                        Replaces PI <span className="font-numeric">{inv.proformaRef}</span>
                      </div>
                    )}
                  </td>
                  <td className="font-numeric text-text px-3 py-3">
                    {fmtDate(inv.invoiceDate)}
                  </td>
                  <td className="px-3 py-3">
                    <Pill variant={statusVariant(inv.status)} dot>
                      {statusLabel(inv.status)}
                    </Pill>
                    {inv.documentKind === 'PROFORMA' && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="caution">Proforma</Badge>
                        {inv.status !== 'REJECTED' && (
                          <Link
                            href={`/vendor/invoices/${inv.id}/tax-invoice`}
                            className="text-accent text-caption font-medium hover:underline"
                          >
                            Upload tax invoice
                          </Link>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="font-numeric text-ink px-3 py-3 text-right">
                    {inr(inv.grossAmount)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
