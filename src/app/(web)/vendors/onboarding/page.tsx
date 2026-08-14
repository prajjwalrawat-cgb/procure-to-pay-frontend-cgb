'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Pill,
} from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import type { OnboardingListItem } from '@/lib/shared';
import {
  useCancelOnboarding,
  useOnboardingQueue,
  type OnboardingTab,
} from '@/lib/api/vendors';
import { useHasPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/shared';
import { useToastStore } from '@/store/toast-store';

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

/** Confirms a withdrawal and captures the reason that lands in the audit log. */
function CancelInviteDialog({
  row,
  onClose,
}: {
  row: OnboardingListItem | null;
  onClose: () => void;
}): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const cancel = useCancelOnboarding();
  const toast = useToastStore((s) => s.push);

  const submit = (): void => {
    if (!row) return;
    if (reason.trim().length < 3) {
      setError('Give a reason — it is recorded in the audit log');
      return;
    }
    setError('');
    cancel.mutate(
      { onboardingId: row.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast(`Invitation to ${row.vendorName} withdrawn`, 'success');
          setReason('');
          onClose();
        },
        onError: (e) => toast(e.message || 'Could not cancel the invitation', 'error'),
      },
    );
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Cancel invitation</DialogTitle>
        <DialogDescription>
          Withdraws the invitation to <strong>{row?.vendorName}</strong>. They never set a
          password, so nothing they can use goes away — the link simply stops working and
          the vendor record is archived. Nothing is deleted, and the reason is recorded in
          the audit log.
        </DialogDescription>
        <div className="mt-4">
          <label className="text-muted mb-1 block text-[12px] font-medium">Reason</label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Duplicate invite — vendor already onboarding under VN-XXXXXX"
            aria-invalid={!!error}
          />
          {error && <p className="text-danger mt-1 text-[12px]">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="default" onClick={onClose}>
            Keep invitation
          </Button>
          <Button variant="danger" onClick={submit} disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelling…' : 'Cancel invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OnboardingQueuePage(): React.JSX.Element {
  const [tab, setTab] = useState<OnboardingTab>('my_review');
  const [cancelling, setCancelling] = useState<OnboardingListItem | null>(null);
  const canReview = useHasPermission(PERMISSIONS.VENDOR_ONBOARDING_REVIEW);

  // Viewers who are never routed an onboarding (finance watching the pipeline)
  // have nothing in "Awaiting my review" — drop the tab and land them on the
  // live queue. Derived rather than stored, because the session roles arrive
  // after the first render and would otherwise pin a reviewer to the fallback.
  const tabs = canReview ? TABS : TABS.filter((t) => t.key !== 'my_review');
  const activeTab: OnboardingTab =
    tab === 'my_review' && !canReview ? 'in_progress' : tab;
  const { data, isLoading, isError } = useOnboardingQueue(activeTab);

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
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[13px] font-medium ${
              activeTab === t.key
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
      ) : isError ? (
        <p className="text-muted text-[13px]">
          Could not load the onboarding queue — your role may not have access to it.
        </p>
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
                <th className="px-3 py-2 text-right font-medium">Actions</th>
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
                    {o.reviewDecision === 'CANCELLED' && (
                      <Pill variant="gray" className="ml-2">
                        Cancelled
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
                  <td className="px-3 py-2 text-right">
                    {o.canCancel && (
                      <button
                        onClick={() => setCancelling(o)}
                        className="text-muted hover:text-danger text-[12px] font-medium"
                      >
                        Cancel invite
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CancelInviteDialog row={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}
