'use client';

import { PageHeader } from '@/components/ui';

import { SAVINGS_METHODOLOGY, type AnalyticsPeriodKey } from '@/lib/shared';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  useBuyerLeaderboard,
  useLogAvoidedCost,
  useSavingsSummary,
} from '@/lib/api/analytics';
import { humanise } from '../_lib';
import { inr, inrCompact } from '@/lib/format';
import { useSessionStore } from '@/store/session-store';

const LEADERBOARD_ROLES = ['TENANT_ADMIN', 'PROCUREMENT_HEAD'];

export default function SavingsPage(): React.JSX.Element {
  const period: AnalyticsPeriodKey = 'YTD';
  const summary = useSavingsSummary(period);
  const roles = useSessionStore((s) => s.user?.roles ?? []);
  const canSeeLeaderboard = roles.some((r) => LEADERBOARD_ROLES.includes(r));
  const leaderboard = useBuyerLeaderboard(period, canSeeLeaderboard);
  const logAvoided = useLogAvoidedCost();
  const [form, setForm] = useState({ baselineValue: '', awardedValue: '', notes: '' });

  return (
    <div>
      <PageHeader
        title="Savings tracker"
        breadcrumbs={[{ label: 'Analytics', href: '/analytics' }, { label: 'Savings' }]}
        description={'Four categories, kept apart on purpose — a single blended savings number hides how much of it is cash and how much is avoidance.'}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        {(summary.data?.totals ?? []).map((t) => (
          <div key={t.initiativeType}
            className="border-line bg-panel rounded-lg border p-3"
          >
            <div className="text-faint flex items-center gap-1 text-[11px]">
              {SAVINGS_METHODOLOGY[t.initiativeType].shortLabel}
              <span title={SAVINGS_METHODOLOGY[t.initiativeType].methodology}>
                <Info className="text-faint h-3 w-3" />
              </span>
            </div>
            <div className={
                'font-numeric mt-1 text-[20px] font-semibold ' +
                (t.hard ? 'text-accent-2' : 'text-ink')
              }
            >
              {inrCompact(t.amount)}
            </div>
            <div className="text-faint text-[10px]">
              {t.count} initiative(s){t.selfReported ? ', self-reported' : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="border-line bg-panel mb-4 rounded-lg border p-4">
        <h3 className="text-ink mb-2 text-[14px] font-semibold">Initiatives</h3>
        <table className="w-full text-[13px]">
          <thead className="border-line border-b text-left text-[12px] text-muted">
            <tr>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Source</th>
              <th className="p-2 text-right">Baseline</th>
              <th className="p-2 text-right">Awarded</th>
              <th className="p-2 text-right">Savings</th>
              <th className="p-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {(summary.data?.initiatives ?? []).map((i) => (
              <tr key={i.id} className="border-line border-b last:border-0">
                <td className="p-2">
                  {SAVINGS_METHODOLOGY[i.initiativeType].shortLabel}
                </td>
                <td className="p-2">
                  {i.sourceType === 'RFQ_AWARD' && i.sourceId ? (
                    <Link href={`/sourcing`} className="text-accent-2 hover:underline">
                      {humanise(i.sourceType)}
                    </Link>
                  ) : (
                    <span className="text-muted">{humanise(i.sourceType)}</span>
                  )}
                </td>
                <td className="font-numeric p-2 text-right tabular-nums">
                  {inr(i.baselineValue)}
                </td>
                <td className="font-numeric p-2 text-right tabular-nums">
                  {inr(i.awardedValue)}
                </td>
                <td className="font-numeric text-accent-2 p-2 text-right tabular-nums">
                  {inr(i.savingsAmount)}
                </td>
                <td className="text-muted font-numeric p-2 text-right tabular-nums">
                  {Number(i.savingsPct).toFixed(1)}%
                </td>
              </tr>
            ))}
            {summary.data && summary.data.initiatives.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted p-4 text-center">
                  No savings recorded yet — award an RFQ to auto-compute hard savings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Buyer leaderboard — hidden entirely without permission */}
        {canSeeLeaderboard && (
          <div className="border-line bg-panel rounded-lg border p-4">
            <h3 className="text-ink mb-2 text-[14px] font-semibold">Buyer leaderboard</h3>
            <table className="w-full text-[13px]">
              <tbody>
                {(leaderboard.data?.rows ?? []).map((r) => (
                  <tr key={r.buyerId} className="border-line border-b last:border-0">
                    <td className="p-2">{r.buyerName}</td>
                    <td className="font-numeric text-accent-2 p-2 text-right tabular-nums">
                      {inr(r.savingsAmount)}
                    </td>
                    <td className="text-faint p-2 text-right">{r.initiativeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Log avoided cost */}
        <div className="border-line bg-panel rounded-lg border p-4">
          <h3 className="text-ink mb-2 text-[14px] font-semibold">Log avoided cost</h3>
          <p className="text-faint mb-2 text-[11px]">
            Self-reported; held for review before it counts.
          </p>
          <div className="flex flex-col gap-2">
            <input
              className="border-line rounded-sm border px-2 py-1.5 text-[13px]"
              placeholder="Baseline value (₹)"
              value={form.baselineValue}
              onChange={(e) => setForm({ ...form, baselineValue: e.target.value })}
            />
            <input
              className="border-line rounded-sm border px-2 py-1.5 text-[13px]"
              placeholder="Actual value (₹)"
              value={form.awardedValue}
              onChange={(e) => setForm({ ...form, awardedValue: e.target.value })}
            />
            <textarea
              className="border-line rounded-sm border px-2 py-1.5 text-[13px]"
              placeholder="Justification (required, min 10 chars)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <button
              onClick={() =>
                logAvoided.mutate(form, {
                  onSuccess: () =>
                    setForm({ baselineValue: '', awardedValue: '', notes: '' }),
                })
              }
              disabled={logAvoided.isPending || form.notes.length < 10}
              className="bg-ink rounded-md px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
            >
              Submit for review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
