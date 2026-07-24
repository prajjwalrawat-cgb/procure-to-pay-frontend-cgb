'use client';

import type { AnalyticsPeriodKey, MsmeBucketKey } from '@/lib/shared';
import Link from 'next/link';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  msmeReportUrl,
  useMsmeDashboard,
  useMsmeExposure,
  useMsmeTrend,
} from '@/lib/api/analytics';
import { openAuthedAsset } from '@/lib/api-client';
import { inr, inrCompact } from '@/lib/format';

import { AsOfBadge } from '../_lib';

const BUCKET_LABEL: Record<MsmeBucketKey, string> = {
  SAFE_0_29: 'Safe (0–29 days)',
  APPROACHING_30_44: 'Approaching (30–44 days)',
  BREACH_45_PLUS: 'Breach (45+ days)',
};

export default function MsmePage(): React.JSX.Element {
  const period: AnalyticsPeriodKey = 'LAST_12M';
  const dash = useMsmeDashboard();
  const trend = useMsmeTrend(period);
  const [bucket, setBucket] = useState<MsmeBucketKey | null>(null);
  const exposure = useMsmeExposure(bucket);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/analytics" className="text-muted text-[12px] hover:underline">
            ← Analytics
          </Link>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            MSME §15 compliance
          </h1>
          <p className="text-muted text-[13px]">
            MSMED Act 2006 — 45-day payment rule. Live aging.
          </p>
        </div>
        <button
          onClick={() => openAuthedAsset('/analytics/msme/report.pdf')}
          className="bg-ink rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
        >
          Generate compliance report
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {(dash.data?.buckets ?? []).map((b) => (
          <button
            key={b.bucket}
            onClick={() => setBucket(b.bucket)}
            className={
              'rounded-lg border p-4 text-left ' +
              (b.bucket === 'BREACH_45_PLUS' && b.invoiceCount > 0
                ? 'border-danger bg-danger-wash'
                : 'border-line bg-panel')
            }
          >
            <div className="text-faint text-[11px] uppercase">
              {BUCKET_LABEL[b.bucket]}
            </div>
            <div className="font-numeric text-ink mt-1 text-[24px] font-semibold">
              {b.invoiceCount}
            </div>
            <div className="text-muted font-numeric text-[12px]">
              {inr(b.totalExposure)} · avg {b.avgDays} days
            </div>
          </button>
        ))}
      </div>

      <div className="border-line bg-panel mb-4 rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-ink text-[14px] font-semibold">
            Breach count &amp; interest exposure (12M)
          </h3>
          <AsOfBadge refreshedAt={trend.data?.refreshedAt ?? null} />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trend.data?.points ?? []}>
            <CartesianGrid stroke="#E8E8E1" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#65655E' }} />
            <YAxis
              tickFormatter={(v) => inrCompact(String(v))}
              tick={{ fontSize: 11, fill: '#65655E' }}
              width={70}
            />
            <Tooltip formatter={(v: number) => inr(String(v))} />
            <Bar
              dataKey={(p: { breachExposure: string }) => Number(p.breachExposure)}
              fill="#DA1C46"
              name="Interest exposure"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {bucket && (
        <div className="border-line bg-panel rounded-lg border p-4">
          <h3 className="text-ink mb-2 text-[14px] font-semibold">
            {BUCKET_LABEL[bucket]} — at-risk invoices
          </h3>
          <table className="w-full text-[13px]">
            <thead className="text-faint border-line border-b text-[11px] uppercase">
              <tr>
                <th className="p-2 text-left">Invoice</th>
                <th className="p-2 text-left">Vendor</th>
                <th className="p-2 text-right">Days</th>
                <th className="p-2 text-right">Net</th>
                <th className="p-2 text-right">Interest if unpaid</th>
              </tr>
            </thead>
            <tbody>
              {(exposure.data?.rows ?? []).map((r) => (
                <tr key={r.invoiceId} className="border-line border-b last:border-0">
                  <td className="font-numeric p-2">{r.invoiceNumber}</td>
                  <td className="p-2">{r.vendorName}</td>
                  <td className="font-numeric p-2 text-right tabular-nums">
                    {r.daysOutstanding}
                  </td>
                  <td className="font-numeric p-2 text-right tabular-nums">
                    {inr(r.netAmount)}
                  </td>
                  <td className="font-numeric text-danger p-2 text-right tabular-nums">
                    {inr(r.interestIfBreached)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {exposure.data && (
            <p className="text-faint mt-2 text-[11px]">
              Interest = net × RBI reference rate ({exposure.data.rbiReferenceRatePct}%) ×
              ×{exposure.data.interestMultiplier} × days late / 365. Estimate only — not a
              posted liability.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
