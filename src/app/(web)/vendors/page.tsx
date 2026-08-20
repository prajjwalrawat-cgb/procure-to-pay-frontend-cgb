'use client';

import { Button, DataState, PageHeader, Pill } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { InviteVendorDialog } from './_components/invite-dialog';
import { useVendorList, type VendorTab } from '@/lib/api/vendors';
import { inr } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/shared';

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
  const { data, isLoading, isError, error, refetch } = useVendorList(tab);
  const canInvite = useHasPermission(PERMISSIONS.VENDOR_INVITE);
  const canSeeQueue = useHasPermission(PERMISSIONS.VENDOR_ONBOARDING_READ);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Vendors"
        description="Vendor master — onboarding, compliance, scorecards and lifecycle."
        actions={
          <>
            {canSeeQueue && (
              <Link href="/vendors/onboarding">
                <Button variant="default" size="sm">
                  Onboarding queue
                </Button>
              </Link>
            )}
            {canInvite && (
              <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                Invite vendor
              </Button>
            )}
          </>
        }
      />

      <div className="border-line mb-4 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            type="button"
            className={`duration-hover shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
              tab === t.key
                ? 'border-accent text-ink'
                : 'text-muted hover:text-ink border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading || isError || !data || data.items.length === 0 ? (
        // Error stays distinct from empty: a 403 rendering as "no vendors"
        // reads as an empty tenant rather than missing access. DataState's
        // error branch says which it is.
        <div className="border-line bg-panel rounded-lg border">
          <DataState
            isLoading={isLoading}
            error={isError ? error : undefined}
            isEmpty={!data || data.items.length === 0}
            onRetry={() => void refetch()}
            empty={{
              title: 'No vendors in this view',
              detail: 'Invited and onboarded suppliers appear here.',
              action: canInvite ? (
                <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                  Invite vendor
                </Button>
              ) : undefined,
            }}
          >
            {null}
          </DataState>
        </div>
      ) : (
        <div className="border-line bg-panel overflow-x-auto rounded-lg border">
          <table className="w-full text-[13px]">
            <thead className="bg-canvas text-muted">
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
                <tr key={v.id} className="border-line hover:bg-canvas border-t">
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
