'use client';

import {
  Button,
  Field,
  Input,
  KpiCard,
  PageHeader,
  SkeletonCards,
  SortableHead,
  TableState,
  Textarea,
  useSort,
} from '@/components/ui';

import { SAVINGS_METHODOLOGY, type AnalyticsPeriodKey } from '@/lib/shared';
import Link from 'next/link';
import { useState } from 'react';

import {
  useBuyerLeaderboard,
  useLogAvoidedCost,
  useSavingsSummary,
} from '@/lib/api/analytics';
import { AnalyticsTabs, humanise } from '../_lib';
import { inr, inrCompact } from '@/lib/format';
import { useSessionStore } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';

const LEADERBOARD_ROLES = ['TENANT_ADMIN', 'PROCUREMENT_HEAD'];

type SortKey = 'type' | 'source' | 'baseline' | 'awarded' | 'savings' | 'pct';

export default function SavingsPage(): React.JSX.Element {
  const period: AnalyticsPeriodKey = 'YTD';
  const summary = useSavingsSummary(period);
  const roles = useSessionStore((s) => s.user?.roles ?? []);
  const canSeeLeaderboard = roles.some((r) => LEADERBOARD_ROLES.includes(r));
  const leaderboard = useBuyerLeaderboard(period, canSeeLeaderboard);
  const logAvoided = useLogAvoidedCost();
  const toast = useToastStore((s) => s.push);
  const [form, setForm] = useState({ baselineValue: '', awardedValue: '', notes: '' });

  const initiatives = summary.data?.initiatives ?? [];
  const { sorted, sort, toggle } = useSort<(typeof initiatives)[number], SortKey>(
    initiatives,
    {
      type: (i) => SAVINGS_METHODOLOGY[i.initiativeType].shortLabel,
      source: (i) => humanise(i.sourceType),
      baseline: (i) => Number(i.baselineValue),
      awarded: (i) => Number(i.awardedValue),
      savings: (i) => Number(i.savingsAmount),
      pct: (i) => Number(i.savingsPct),
    },
  );

  const submit = (): void =>
    logAvoided.mutate(form, {
      onSuccess: () => {
        setForm({ baselineValue: '', awardedValue: '', notes: '' });
        toast('Submitted for review', 'success');
      },
      onError: (e) => toast((e as Error).message || 'Could not log the saving', 'error'),
    });

  return (
    <div>
      <PageHeader
        title="Savings tracker"
        breadcrumbs={[{ label: 'Analytics', href: '/analytics' }, { label: 'Savings' }]}
        description="Four categories, kept apart on purpose. A single blended savings number hides how much of it is cash and how much is avoidance."
      />

      <AnalyticsTabs active="/analytics/savings" />

      {summary.isLoading ? (
        <SkeletonCards count={4} className="mb-4 xl:grid-cols-4" />
      ) : (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(summary.data?.totals ?? []).map((t) => (
            <KpiCard
              key={t.initiativeType}
              label={SAVINGS_METHODOLOGY[t.initiativeType].shortLabel}
              help={SAVINGS_METHODOLOGY[t.initiativeType].methodology}
              value={inrCompact(t.amount)}
              footnote={`${t.count} initiative${t.count === 1 ? '' : 's'}${
                t.selfReported ? ', self-reported' : ''
              }`}
            />
          ))}
        </div>
      )}

      <div className="border-line bg-panel mb-4 overflow-hidden rounded-lg border">
        <h3 className="text-ink border-line border-b px-4 py-3 text-h3 font-semibold">
          Initiatives
        </h3>
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left">
            <tr>
              <SortableHead label="Type" sortKey="type" sort={sort} onSort={toggle} />
              <SortableHead label="Source" sortKey="source" sort={sort} onSort={toggle} />
              <SortableHead label="Baseline" sortKey="baseline" sort={sort} onSort={toggle} numeric />
              <SortableHead label="Awarded" sortKey="awarded" sort={sort} onSort={toggle} numeric />
              <SortableHead label="Savings" sortKey="savings" sort={sort} onSort={toggle} numeric />
              <SortableHead label="%" sortKey="pct" sort={sort} onSort={toggle} numeric />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={6}
              isLoading={summary.isLoading}
              error={summary.error}
              onRetry={() => void summary.refetch()}
              isEmpty={initiatives.length === 0}
              empty={{
                title: 'No savings recorded yet',
                detail: 'Awarding an RFQ computes hard savings automatically. Avoided costs logged below appear here once reviewed.',
              }}
            />
            {!summary.isLoading &&
              sorted.map((i) => (
                <tr key={i.id} className="border-line border-b last:border-0">
                  <td className="text-text px-3 py-3">
                    {SAVINGS_METHODOLOGY[i.initiativeType].shortLabel}
                  </td>
                  <td className="px-3 py-3">
                    {i.sourceType === 'RFQ_AWARD' && i.sourceId ? (
                      <Link href="/sourcing" className="text-accent hover:underline">
                        {humanise(i.sourceType)}
                      </Link>
                    ) : (
                      <span className="text-muted">{humanise(i.sourceType)}</span>
                    )}
                  </td>
                  <td className="font-numeric px-3 py-3 text-right tabular-nums">
                    {inr(i.baselineValue)}
                  </td>
                  <td className="font-numeric px-3 py-3 text-right tabular-nums">
                    {inr(i.awardedValue)}
                  </td>
                  <td className="font-numeric text-success px-3 py-3 text-right tabular-nums">
                    {inr(i.savingsAmount)}
                  </td>
                  <td className="text-muted font-numeric px-3 py-3 text-right tabular-nums">
                    {Number(i.savingsPct).toFixed(1)}%
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* Buyer leaderboard — hidden entirely without permission */}
        {canSeeLeaderboard && (
          <div className="border-line bg-panel overflow-hidden rounded-lg border">
            <h3 className="text-ink border-line border-b px-4 py-3 text-h3 font-semibold">
              Buyer leaderboard
            </h3>
            <table className="pf-stack w-full text-body-sm">
              <thead className="border-line border-b text-left text-caption text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Buyer</th>
                  <th className="px-3 py-2.5 text-right font-medium">Savings</th>
                  <th className="px-3 py-2.5 text-right font-medium">Initiatives</th>
                </tr>
              </thead>
              <tbody>
                <TableState
                  colSpan={3}
                  skeletonRows={3}
                  isLoading={leaderboard.isLoading}
                  error={leaderboard.error}
                  onRetry={() => void leaderboard.refetch()}
                  isEmpty={(leaderboard.data?.rows ?? []).length === 0}
                  empty={{ title: 'No buyer has recorded a saving yet' }}
                />
                {(leaderboard.data?.rows ?? []).map((r) => (
                  <tr key={r.buyerId} className="border-line border-b last:border-0">
                    <td className="text-text px-3 py-3">{r.buyerName}</td>
                    <td className="font-numeric text-success px-3 py-3 text-right tabular-nums">
                      {inr(r.savingsAmount)}
                    </td>
                    <td className="font-numeric text-muted px-3 py-3 text-right">
                      {r.initiativeCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Log avoided cost */}
        <div className="border-line bg-panel rounded-lg border p-4">
          <h3 className="text-ink text-h3 font-semibold">Log avoided cost</h3>
          <p className="text-muted mb-3 mt-0.5 text-caption">
            Self-reported, and held for review before it counts.
          </p>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Baseline value (₹)" htmlFor="avoided-baseline">
                <Input
                  id="avoided-baseline"
                  inputMode="decimal"
                  value={form.baselineValue}
                  onChange={(e) => setForm({ ...form, baselineValue: e.target.value })}
                />
              </Field>
              <Field label="Actual value (₹)" htmlFor="avoided-actual">
                <Input
                  id="avoided-actual"
                  inputMode="decimal"
                  value={form.awardedValue}
                  onChange={(e) => setForm({ ...form, awardedValue: e.target.value })}
                />
              </Field>
            </div>
            <Field
              label="Justification"
              htmlFor="avoided-notes"
              required
              hint="At least 10 characters. Say what was avoided and how you know."
            >
              <Textarea
                id="avoided-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={submit}
                disabled={logAvoided.isPending || form.notes.length < 10}
              >
                {logAvoided.isPending ? 'Submitting…' : 'Submit for review'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
