'use client';

import { Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useRmas, type RmaTab } from '@/lib/api/rma';
import { inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: RmaTab; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'issued', label: 'Issued' },
  { key: 'awaiting_pickup', label: 'Awaiting pickup' },
  { key: 'awaiting_credit_note', label: 'Awaiting credit note' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

export default function RmaListPage(): React.JSX.Element {
  const [tab, setTab] = useState<RmaTab>('all');
  const { data, isLoading } = useRmas(tab);
  const counts = data?.counts;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          Return authorisations
        </h1>
        <p className="text-muted text-[13px]">
          Rejected-material returns · Star Cement Ltd
        </p>
      </div>

      <div className="border-line mb-3 flex items-center gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'duration-hover flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
              (tab === t.key
                ? 'border-accent text-ink'
                : 'text-muted hover:text-text border-transparent')
            }
          >
            {t.label}
            <span className="font-numeric text-faint text-[11px]">
              {counts?.[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 font-medium">RMA</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">GRN</th>
              <th className="px-3 py-2 font-medium">Reason</th>
              <th className="px-3 py-2 text-right font-medium">Return value</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="text-muted px-3 py-8 text-center">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="text-muted px-3 py-8 text-center">
                  No return authorisations in this view.
                </td>
              </tr>
            )}
            {data?.items.map((r) => (
              <tr key={r.id} className="border-line hover:bg-canvas/60 border-t">
                <td className="px-3 py-2">
                  <Link
                    href={`/rma/${r.id}`}
                    className="font-numeric text-ink font-medium"
                  >
                    {r.number}
                  </Link>
                  <div className="mt-0.5">
                    <Pill variant={statusVariant(r.status)} dot>
                      {statusLabel(r.status)}
                    </Pill>
                  </div>
                </td>
                <td className="text-text px-3 py-2">{r.vendor.name}</td>
                <td className="font-numeric text-text px-3 py-2 text-[12px]">
                  {r.grn.number}
                </td>
                <td className="text-muted px-3 py-2 text-[12px]">{r.reasonCode}</td>
                <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                  {inr(r.totalReturnValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
