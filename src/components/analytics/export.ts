'use client';

import type {
  AnalyticsOverviewResponse,
  MsmeComplianceResponse,
  SpendByCategoryResponse,
  SpendSavingsResponse,
  VelocityResponse,
} from '@/lib/shared';

import { downloadCsv } from '@/lib/csv';

import { rangeLabel, type UrlRange } from './range';

interface Row {
  section: string;
  metric: string;
  value: string | number | null;
  unit: string;
  basis: string;
}

/**
 * Every figure the page shows, one row each, in page order. Values go out raw
 * (full-precision amounts, unrounded counts) rather than as the compact
 * on-screen strings — a spreadsheet wants ₹12,34,567.89, not "₹12.35 L".
 * Sections that failed or haven't loaded are simply absent.
 */
export function exportAnalytics(
  range: UrlRange,
  data: {
    overview?: AnalyticsOverviewResponse;
    savings?: SpendSavingsResponse;
    category?: SpendByCategoryResponse;
    velocity?: VelocityResponse;
    msme?: MsmeComplianceResponse;
  },
): void {
  const inRange = rangeLabel(range);
  const live = 'Live snapshot';
  const rows: Row[] = [];
  const add = (section: string, metric: string, value: Row['value'], unit: string, basis = inRange) =>
    rows.push({ section, metric, value, unit, basis });

  const o = data.overview;
  if (o) {
    add('Overview', 'Spend under management', o.spendUnderManagement, 'INR');
    add('Overview', 'POs issued', o.posIssued, 'count');
    add('Overview', 'Invoices processed', o.invoicesProcessed, 'count');
    add('Overview', 'Active vendors', o.activeVendors, 'count');
    add('Overview', 'Invoice to pay (median)', o.avgInvoiceToPayDays, 'days');
    add('Overview', 'MSME compliance score', o.msmeComplianceScore, '%', 'MSME invoices due in the last 90 days');
  }

  const s = data.savings;
  if (s) {
    add('Spend & savings', 'Savings realized', s.savingsRealized.amount, 'INR');
    add('Spend & savings', 'Savings as % of baseline', s.savingsRealized.pct, '%');
    add('Spend & savings', 'Savings entries', s.savingsRealized.count, 'count');
    add('Spend & savings', 'Top-5 vendor concentration', s.top5Concentration, '%');
    add('Spend & savings', 'Maverick spend', s.maverick.amount, 'INR');
    add('Spend & savings', 'Maverick spend share', s.maverick.pct, '%');
    add('Spend & savings', 'RFQs awarded', s.rfqsAwarded, 'count');
  }

  const c = data.category;
  if (c) {
    for (const sl of [...c.slices].sort((a, b) => Number(b.netSpend) - Number(a.netSpend))) {
      add('Spend by category', sl.category, sl.netSpend, 'INR');
      add('Spend by category', `${sl.category} share`, sl.pct, '%');
    }
  }

  const v = data.velocity;
  if (v) {
    for (const st of v.stages) {
      add('Cycle time', `${st.label} median`, st.medianDays, 'days');
      add('Cycle time', `${st.label} P90`, st.p90Days, 'days');
      add('Cycle time', `${st.label} measured`, st.n, 'count');
    }
    add('Queue depth', 'Pending approvals', v.queue.pendingApprovals, 'count', live);
    add('Queue depth', 'POs awaiting receipt', v.queue.pendingGrns, 'count', live);
    add('Queue depth', 'Payment runs pending', v.queue.pendingPaymentRuns, 'count', live);
    if (v.slowestStep) {
      const ss = v.slowestStep;
      add('Queue depth', `Slowest approval step: ${ss.stepName} (${ss.documentType}, step ${ss.stepNo}) median`, ss.medianHours, 'hours');
      add('Queue depth', 'Slowest approval step decisions', ss.n, 'count');
    }
  }

  const m = data.msme;
  if (m) {
    add('MSME compliance', 'Overdue exposure (>45 days)', m.overdueExposure, 'INR', live);
    add('MSME compliance', 'Overdue invoices', m.overdueCount, 'count', live);
    add('MSME compliance', 'Compliance score', m.complianceScore, '%', 'MSME invoices due in the last 90 days');
    add('MSME compliance', 'Due within 7 days', m.approachingCount, 'count', live);
    add('MSME compliance', 'Total MSME exposure', m.totalExposure, 'INR', live);
    for (const b of m.buckets) {
      add('MSME aging', `${b.label} outstanding`, b.amount, 'INR', live);
      add('MSME aging', `${b.label} invoices`, b.count, 'count', live);
    }
    for (const r of m.atRisk) {
      add('MSME at risk', `${r.invoiceNumber} · ${r.vendorName} outstanding`, r.outstanding, 'INR', live);
      add('MSME at risk', `${r.invoiceNumber} · ${r.vendorName} days overdue`, r.daysOverdue, 'days', live);
    }
  }

  const stamp = range.period === 'CUSTOM' ? `${range.from}_${range.to}` : range.period.toLowerCase();
  downloadCsv(`analytics-${stamp}-${new Date().toISOString().slice(0, 10)}`, rows, [
    { header: 'Section', value: (r) => r.section },
    { header: 'Metric', value: (r) => r.metric },
    { header: 'Value', value: (r) => r.value },
    { header: 'Unit', value: (r) => r.unit },
    { header: 'Period', value: (r) => r.basis },
  ]);
}
