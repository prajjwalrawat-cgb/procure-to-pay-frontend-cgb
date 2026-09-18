'use client';

import {
  PageHeader,
  Pill,
  SubNav,
} from '@/components/ui';
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
    <div>
      <div className="mb-4">
        <PageHeader
          title="Return authorisations"
          description="Rejected-material returns"
        />
      </div>

      <SubNav
        className="mb-3"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: counts?.[t.key] ?? 0,
        }))}
        value={tab}
        onChange={(k) => setTab(k as (typeof TABS)[number]['key'])}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-line border-b text-left text-[12px] text-muted">
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
