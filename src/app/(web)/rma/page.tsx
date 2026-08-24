'use client';

import { PageHeader, Pill } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useRmas, type RmaTab } from '@/lib/api/rma';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { tenantSuffix, useTenantName } from '@/store/session-store';

const TABS: { key: RmaTab; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'issued', label: 'Issued' },
  { key: 'awaiting_pickup', label: 'Awaiting pickup' },
  { key: 'awaiting_credit_note', label: 'Awaiting credit note' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

export default function RmaListPage(): React.JSX.Element {
  const tenantName = useTenantName();
  const [tab, setTab] = useState<RmaTab>('all');
  const { data, isLoading } = useRmas(tab);
  const counts = data?.counts;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <PageHeader
          title="Return authorisations"
          description={<>Rejected-material returns{tenantSuffix(tenantName)}</>}
        />
      </div>

      <div className="mb-3 flex items-center gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors duration-hover ' +
              (tab === t.key
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-text')
            }
          >
            {t.label}
            <span className="font-numeric text-[11px] text-faint">
              {counts?.[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-left text-[11px] uppercase tracking-wide text-faint">
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
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  No return authorisations in this view.
                </td>
              </tr>
            )}
            {data?.items.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-canvas/60">
                <td className="px-3 py-2">
                  <Link
                    href={`/rma/${r.id}`}
                    className="font-numeric font-medium text-ink"
                  >
                    {r.number}
                  </Link>
                  <div className="mt-0.5">
                    <Pill variant={statusVariant(r.status)} dot>
                      {statusLabel(r.status)}
                    </Pill>
                  </div>
                </td>
                <td className="px-3 py-2 text-text">{r.vendor.name}</td>
                <td className="font-numeric px-3 py-2 text-[12px] text-text">
                  {r.grn.number}
                </td>
                <td className="px-3 py-2 text-[12px] text-muted">{r.reasonCode}</td>
                <td className="font-numeric px-3 py-2 text-right font-medium text-ink">
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
