'use client';

import type { ContractTab } from '@/lib/shared';
import { Pill } from '@/components/ui';
import { Plus, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useContracts } from '@/lib/api/contracts';
import { inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: ContractTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'awaiting_approval', label: 'Awaiting approval' },
  { key: 'expiring_soon', label: 'Expiring soon' },
  { key: 'expired', label: 'Expired' },
  { key: 'terminated', label: 'Terminated' },
];

const TYPE_LABEL: Record<string, string> = {
  RATE_CONTRACT: 'Rate',
  FRAMEWORK_AGREEMENT: 'Framework',
  BLANKET_PO: 'Blanket',
  SERVICE_AGREEMENT: 'Service',
};

export default function ContractsPage(): React.JSX.Element {
  const [tab, setTab] = useState<ContractTab>('active');
  const { data, isLoading } = useContracts(tab);
  const counts = data?.counts;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Contracts
          </h1>
          <p className="text-muted text-[13px]">
            Rate contracts, framework agreements & call-offs · Star Cement Ltd
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/contracts/clause-library"
            className="border-line text-text hover:bg-canvas rounded-md border px-3 py-1.5 text-[13px] font-medium"
          >
            Clause library
          </Link>
          <Link
            href="/contracts/renewals"
            className="border-line text-text hover:bg-canvas rounded-md border px-3 py-1.5 text-[13px] font-medium"
          >
            Renewal calendar
          </Link>
          <Link
            href="/contracts/new"
            className="bg-ink flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> New contract
          </Link>
        </div>
      </div>

      <div className="border-line mb-3 flex items-center gap-1 border-b">
        {TABS.map((t) => {
          const n = counts?.[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                'duration-hover flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
                (tab === t.key
                  ? 'border-ink text-ink'
                  : 'text-muted hover:text-text border-transparent')
              }
            >
              {t.label}
              {typeof n === 'number' && n > 0 && (
                <span className="bg-canvas text-muted rounded px-1.5 py-0.5 text-[11px]">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="text-muted py-10 text-center text-[13px]">Loading contracts…</p>
      ) : !data || data.items.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 py-16 text-center text-[13px]">
          <ScrollText className="text-faint h-8 w-8" />
          No contracts in this view.
        </div>
      ) : (
        <div className="border-line overflow-x-auto rounded-lg border">
          <table className="w-full text-[13px]">
            <thead className="bg-canvas text-muted border-line border-b text-left text-[12px]">
              <tr>
                <th className="px-3 py-2 font-medium">Contract</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Validity</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr
                  key={c.id}
                  className="border-line hover:bg-canvas border-b last:border-0"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-numeric text-accent-2 font-medium"
                    >
                      {c.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{c.title}</td>
                  <td className="text-text px-3 py-2">{c.vendor.name}</td>
                  <td className="px-3 py-2">
                    <Pill variant="gray">
                      {TYPE_LABEL[c.contractType] ?? c.contractType}
                    </Pill>
                  </td>
                  <td className="font-numeric px-3 py-2 text-right">
                    {inr(c.totalValueEstimate)}
                  </td>
                  <td className="text-muted px-3 py-2">
                    <span className="font-numeric">{c.validityEnd.slice(0, 10)}</span>
                    {c.daysToExpiry >= 0 && c.daysToExpiry <= 90 && (
                      <span className="text-warn ml-1.5 text-[11px]">
                        · {c.daysToExpiry}d left
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Pill variant={statusVariant(c.status)} dot>
                      {statusLabel(c.status)}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
