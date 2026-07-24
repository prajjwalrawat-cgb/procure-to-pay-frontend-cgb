'use client';

import type { AnalyticsPeriodKey } from '@procureflow/shared';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useApPerformance } from '@/lib/api/analytics';

import { ACCENT } from '../_lib';

export default function ApPerformancePage(): React.JSX.Element {
  const period: AnalyticsPeriodKey = 'LAST_12M';
  const ap = useApPerformance(period);
  const d = ap.data;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <Link href="/analytics" className="text-muted text-[12px] hover:underline">
          ← Analytics
        </Link>
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          AP performance
        </h1>
        <p className="text-muted text-[13px]">
          Cycle time, first-pass yield, exception rate, straight-through — from real
          invoice data.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Avg cycle (days)" value={d ? String(d.avgCycleDays) : '—'} />
        <Kpi
          label="First-pass yield"
          value={d ? `${d.firstPassYieldPct}%` : '—'}
          accent
        />
        <Kpi label="Exception rate" value={d ? `${d.exceptionRatePct}%` : '—'} />
        <Kpi
          label="Straight-through"
          value={d ? `${d.straightThroughPct}%` : '—'}
          accent
        />
        <Kpi
          label="Discount capture"
          value={
            d ? (d.discountCapturePct == null ? 'n/a' : `${d.discountCapturePct}%`) : '—'
          }
          hint={
            d && d.discountCapturePct == null
              ? 'No early-payment discount terms in use'
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Cycle time — with exception vs clean match">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d?.cycleTrend ?? []}>
              <CartesianGrid stroke="#E8E8E1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#65655E' }} />
              <YAxis tick={{ fontSize: 11, fill: '#65655E' }} width={40} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="cleanMatch"
                stroke={ACCENT}
                strokeWidth={2}
                dot={false}
                name="Clean match"
              />
              <Line
                type="monotone"
                dataKey="withException"
                stroke="#DA1C46"
                strokeWidth={2}
                dot={false}
                name="With exception"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Exception rate by type">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d?.exceptionBreakdown ?? []}>
              <CartesianGrid stroke="#E8E8E1" vertical={false} />
              <XAxis
                dataKey="exceptionType"
                tick={{ fontSize: 10, fill: '#65655E' }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#65655E' }} width={30} />
              <Tooltip />
              <Bar dataKey="count" fill="#AF6005" radius={[4, 4, 0, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="First-pass yield trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d?.fpyTrend ?? []}>
              <CartesianGrid stroke="#E8E8E1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#65655E' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#65655E' }}
                width={35}
                domain={[0, 100]}
              />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line
                type="monotone"
                dataKey="pct"
                stroke={ACCENT}
                strokeWidth={2}
                dot={false}
                name="FPY %"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Straight-through processing trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d?.stpTrend ?? []}>
              <CartesianGrid stroke="#E8E8E1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#65655E' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#65655E' }}
                width={35}
                domain={[0, 100]}
              />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="#0276B2"
                strokeWidth={2}
                dot={false}
                name="STP %"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-3">
      <div className="text-faint text-[11px] uppercase">{label}</div>
      <div
        className={
          'font-numeric mt-1 text-[20px] font-semibold ' +
          (accent ? 'text-accent-2' : 'text-ink')
        }
      >
        {value}
      </div>
      {hint && <div className="text-faint mt-0.5 text-[10px]">{hint}</div>}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-4">
      <h3 className="text-ink mb-2 text-[14px] font-semibold">{title}</h3>
      {children}
    </div>
  );
}
