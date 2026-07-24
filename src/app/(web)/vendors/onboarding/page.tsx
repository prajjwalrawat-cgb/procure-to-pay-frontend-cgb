'use client';

import { Pill } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useOnboardingQueue, type OnboardingTab } from '@/lib/api/vendors';

const TABS: { key: OnboardingTab; label: string }[] = [
  { key: 'my_review', label: 'Awaiting my review' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

function slaVariant(breachAt: string | null): 'success' | 'warn' | 'danger' | 'gray' {
  if (!breachAt) return 'gray';
  const hrs = (new Date(breachAt).getTime() - Date.now()) / 3_600_000;
  if (hrs < 0) return 'danger';
  if (hrs < 24) return 'warn';
  return 'success';
}

export default function OnboardingQueuePage(): React.JSX.Element {
  const [tab, setTab] = useState<OnboardingTab>('my_review');
  const { data, isLoading } = useOnboardingQueue(tab);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4">
        <Link href="/vendors" className="text-muted hover:text-ink text-[12px]">
          ← Vendors
        </Link>
        <h1 className="tracking-heading text-ink mt-1 text-[20px] font-semibold">
          Onboarding queue
        </h1>
        <p className="text-muted text-[13px]">
          Invited and self-registered vendors working through the onboarding wizard.
        </p>
      </div>

      <div className="border-line mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[13px] font-medium ${
              tab === t.key
                ? 'text-ink border-ink border-b-2'
                : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted text-[13px]">Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-muted text-[13px]">Nothing in this view.</p>
      ) : (
        <div className="border-line overflow-hidden rounded-lg border">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Vendor</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-left font-medium">Progress</th>
                <th className="px-3 py-2 text-left font-medium">Docs</th>
                <th className="px-3 py-2 text-left font-medium">Days open</th>
                <th className="px-3 py-2 text-left font-medium">SLA</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="border-line hover:bg-surface-2 border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/vendors/onboarding/${o.id}`}
                      className="text-brand font-medium hover:underline"
                    >
                      {o.vendorName}
                    </Link>
                    {o.isMsme && (
                      <Pill variant="info" className="ml-2">
                        MSME
                      </Pill>
                    )}
                    {o.stalled && (
                      <Pill variant="warn" className="ml-2">
                        Stalled
                      </Pill>
                    )}
                  </td>
                  <td className="text-muted px-3 py-2">{o.category ?? '—'}</td>
                  <td className="text-muted px-3 py-2">
                    {o.invitationSource.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-canvas h-1.5 w-24 overflow-hidden rounded-full">
                        <div
                          className="bg-brand h-full"
                          style={{ width: `${o.completionPct}%` }}
                        />
                      </div>
                      <span className="text-muted tabular-nums">{o.completionPct}%</span>
                    </div>
                  </td>
                  <td className="text-muted px-3 py-2 tabular-nums">
                    {o.docsVerified}/{o.docsRequired}
                  </td>
                  <td className="text-muted px-3 py-2 tabular-nums">{o.daysOpen}d</td>
                  <td className="px-3 py-2">
                    <Pill variant={slaVariant(o.slaBreachAt)} dot>
                      {o.slaBreachAt ? new Date(o.slaBreachAt).toLocaleDateString() : '—'}
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
