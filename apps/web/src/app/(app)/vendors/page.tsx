'use client';

import { Button, Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useState } from 'react';

import { InviteVendorDialog } from './_components/invite-dialog';
import { useVendorList, type VendorTab } from '@/lib/api/vendors';
import { inr } from '@/lib/format';

const TABS: { key: VendorTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'blacklisted', label: 'Blacklisted' },
  { key: 'all', label: 'All' },
];

function gradeVariant(grade: string | null): 'success' | 'warn' | 'danger' | 'gray' {
  if (!grade) return 'gray';
  if (grade.startsWith('A')) return 'success';
  if (grade === 'B') return 'warn';
  if (grade === 'N/A') return 'gray';
  return 'danger';
}

export default function VendorsPage(): React.JSX.Element {
  const [tab, setTab] = useState<VendorTab>('active');
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data, isLoading } = useVendorList(tab);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">Vendors</h1>
          <p className="text-muted text-[13px]">
            Vendor master — onboarding, compliance, scorecards and lifecycle.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/vendors/onboarding">
            <Button variant="default">Onboarding queue</Button>
          </Link>
          <Button variant="primary" onClick={() => setInviteOpen(true)}>
            Invite vendor
          </Button>
        </div>
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
        <p className="text-muted text-[13px]">No vendors in this view.</p>
      ) : (
        <div className="border-line overflow-hidden rounded-lg border">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Code</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">MSME</th>
                <th className="px-3 py-2 text-left font-medium">Risk</th>
                <th className="px-3 py-2 text-left font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">FYTD spend</th>
                <th className="px-3 py-2 text-right font-medium">Active POs</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v.id} className="border-line hover:bg-surface-2 border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/vendors/${v.id}`}
                      className="text-brand font-medium hover:underline"
                    >
                      {v.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{v.name}</td>
                  <td className="text-muted px-3 py-2">{v.category ?? '—'}</td>
                  <td className="px-3 py-2">
                    {v.isMsme ? (
                      <Pill variant="info">MSME</Pill>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {v.riskGrade ? (
                      <Pill variant={gradeVariant(v.riskGrade)}>{v.riskGrade}</Pill>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Pill variant={gradeVariant(v.scorecardGrade)}>
                      {v.scorecardGrade ?? 'N/A'}
                    </Pill>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {inr(v.fytdSpend)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.activePoCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteVendorDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
