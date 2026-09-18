'use client';

import { Button, Input, PageHeader, Pill } from '@/components/ui';
import { Money } from '@/lib/shared';
import { Download, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useMyInvoices, type VendorInvoiceSummary } from '@/vendor/lib/api/invoices';
import { formatDate } from '@/lib/format';

const VARIANT: Record<string, 'success' | 'warn' | 'info' | 'gray'> = {
  PAID: 'success',
  APPROVED: 'success',
  OCR_DONE: 'success',
  AWAITING_APPROVAL: 'warn',
  MATCH_EXCEPTION: 'warn',
  OCR_PENDING: 'info',
  RECEIVED: 'info',
};

const label = (status: string): string => status.replace(/_/g, ' ');
const fmtDate = (iso: string): string => formatDate(iso);
const inr = (v: string): string => Money.of(v || 0).toINR();

export default function VendorInvoicesPage(): React.JSX.Element {
  const { data, isLoading } = useMyInvoices();
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

  const total = useMemo(
    () => rows.reduce((acc, r) => acc.add(r.grossAmount || 0), Money.zero()),
    [rows],
  );

  const exportCsv = (): void => {
    const header = 'Invoice,Reference,Invoice Date,Status,Amount';
    const body = rows
      .map((r) =>
        [
          r.number,
          csv(r.vendorInvoiceRef),
          fmtDate(r.invoiceDate),
          label(r.status),
          r.grossAmount,
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}\n`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-invoices.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="My invoices"
        description="Invoices you have submitted and their live status"
        actions={
          <>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={exportCsv}
                disabled={rows.length === 0}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export
              </Button>
              <Link href="/vendor/invoices/submit">
                <Button variant="primary" size="sm">
                  Submit invoice
                </Button>
              </Link>
            </div>
          </>
        }
      />

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice or reference…"
            className="h-8 w-64 pl-8"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 rounded-sm border border-line bg-panel px-2.5 text-[13px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[12px] text-muted">
          {rows.length} shown, {inr(total.toString())}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-line border-b text-left text-[12px] text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Invoice</th>
                <th className="px-3 py-2.5 font-medium">Reference</th>
                <th className="px-3 py-2.5 font-medium">Invoice date</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted">
                    {(data?.length ?? 0) === 0
                      ? 'No invoices submitted yet.'
                      : 'No invoices match your filters.'}
                  </td>
                </tr>
              )}
              {rows.map((inv: VendorInvoiceSummary) => (
                <tr key={inv.id} className="border-t border-line hover:bg-canvas/60">
                  <td className="font-numeric px-3 py-2.5 font-medium text-ink">
                    {inv.number}
                  </td>
                  <td className="font-numeric px-3 py-2.5 text-muted">
                    {inv.vendorInvoiceRef}
                  </td>
                  <td className="font-numeric px-3 py-2.5 text-text">
                    {fmtDate(inv.invoiceDate)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill variant={VARIANT[inv.status] ?? 'gray'} dot>
                      {label(inv.status)}
                    </Pill>
                  </td>
                  <td className="font-numeric px-3 py-2.5 text-right text-ink">
                    {inr(inv.grossAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function csv(value: string): string {
  return value.replace(/[,\r\n]+/g, ' ').trim();
}
