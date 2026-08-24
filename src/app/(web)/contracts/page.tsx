'use client';

import type { ContractTab } from '@/lib/shared';
import { PageHeader, Pill } from '@/components/ui';
import { Plus, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useContracts } from '@/lib/api/contracts';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { tenantSuffix, useTenantName } from '@/store/session-store';

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
  const tenantName = useTenantName();
  const [tab, setTab] = useState<ContractTab>('active');
  const { data, isLoading } = useContracts(tab);
  const counts = data?.counts;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Contracts"
        description={`Rate contracts, framework agreements & call-offs${tenantSuffix(tenantName)}`}
        actions={
          <>
            <Link
              href="/contracts/clause-library"
              className="rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-text hover:bg-canvas"
            >
              Clause library
            </Link>
            <Link
              href="/contracts/renewals"
              className="rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-text hover:bg-canvas"
            >
              Renewal calendar
            </Link>
            <Link
              href="/contracts/new"
              className="flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-white"
            >
              <Plus className="h-3.5 w-3.5" /> New contract
            </Link>
          </>
        }
      />

      <div className="mb-3 flex items-center gap-1 border-b border-line">
        {TABS.map((t) => {
          const n = counts?.[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors duration-hover ' +
                (tab === t.key
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-text')
              }
            >
              {t.label}
              {typeof n === 'number' && n > 0 && (
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-[13px] text-muted">Loading contracts…</p>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-[13px] text-muted">
          <ScrollText className="h-8 w-8 text-faint" />
          No contracts in this view.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-[13px]">
            <thead className="border-b border-line bg-canvas text-left text-[12px] text-muted">
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
                  className="border-b border-line last:border-0 hover:bg-canvas"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-numeric font-medium text-accent-2"
                    >
                      {c.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{c.title}</td>
                  <td className="px-3 py-2 text-text">{c.vendor.name}</td>
                  <td className="px-3 py-2">
                    <Pill variant="gray">
                      {TYPE_LABEL[c.contractType] ?? c.contractType}
                    </Pill>
                  </td>
                  <td className="font-numeric px-3 py-2 text-right">
                    {inr(c.totalValueEstimate)}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    <span className="font-numeric">{c.validityEnd.slice(0, 10)}</span>
                    {c.daysToExpiry >= 0 && c.daysToExpiry <= 90 && (
                      <span className="ml-1.5 text-[11px] text-warn">
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
