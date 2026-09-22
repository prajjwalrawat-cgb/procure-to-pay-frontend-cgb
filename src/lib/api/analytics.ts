'use client';

import type {
  AnalyticsOverviewResponse,
  AnalyticsPeriodKey,
  MsmeComplianceResponse,
  SpendSavingsResponse,
  VelocityResponse,
  ApPerformanceResponse,
  BuyerLeaderboardResponse,
  CategoryPerformanceResponse,
  ConcentrationResponse,
  ContractCoverageResponse,
  MsmeBucketKey,
  MsmeComplianceTrendResponse,
  MsmeDashboardResponse,
  MsmeExposureResponse,
  MsmeParticipationResponse,
  RefreshResponse,
  RiskDistributionResponse,
  SavingsSummaryResponse,
  SpendByCategoryResponse,
  SpendTrendResponse,
  TopVendorsResponse,
  TotalSpendResponse,
} from '@/lib/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { API_URL } from '@/lib/env';
import { apiFetch } from '@/lib/api-client';

export const analyticsKeys = {
  all: ['analytics'] as const,
  k: (name: string, period: string) => ['analytics', name, period] as const,
};

const q = (period: AnalyticsPeriodKey): string => `?period=${period}`;

function useAnalytics<T>(
  name: string,
  path: string,
  period: AnalyticsPeriodKey,
): UseQueryResult<T> {
  return useQuery({
    queryKey: analyticsKeys.k(name, period),
    queryFn: () => apiFetch<T>(`/analytics/${path}${q(period)}`),
    staleTime: 60_000,
  });
}

export const useTotalSpend = (p: AnalyticsPeriodKey) =>
  useAnalytics<TotalSpendResponse>('spend-total', 'spend/total', p);
export const useSpendTrend = (p: AnalyticsPeriodKey, compare: boolean) =>
  useQuery({
    queryKey: [...analyticsKeys.k('spend-trend', p), compare],
    queryFn: () =>
      apiFetch<SpendTrendResponse>(
        `/analytics/spend/trend?period=${p}&compareToLastYear=${compare}`,
      ),
    staleTime: 60_000,
  });
export const useSpendByCategory = (p: AnalyticsPeriodKey) =>
  useAnalytics<SpendByCategoryResponse>('spend-cat', 'spend/by-category', p);
export const useTopVendors = (p: AnalyticsPeriodKey) =>
  useAnalytics<TopVendorsResponse>('top-vendors', 'spend/top-vendors', p);
export const useConcentration = (p: AnalyticsPeriodKey) =>
  useAnalytics<ConcentrationResponse>('concentration', 'spend/concentration', p);
export const useContractCoverage = (p: AnalyticsPeriodKey) =>
  useAnalytics<ContractCoverageResponse>('coverage', 'contracts/coverage', p);

export const useMsmeDashboard = () =>
  useAnalytics<MsmeDashboardResponse>('msme-dash', 'msme/dashboard', 'LAST_12M');
export const useMsmeTrend = (p: AnalyticsPeriodKey) =>
  useAnalytics<MsmeComplianceTrendResponse>('msme-trend', 'msme/trend', p);
export const useMsmeExposure = (bucket: MsmeBucketKey | null) =>
  useQuery({
    queryKey: ['analytics', 'msme-exposure', bucket],
    queryFn: () => apiFetch<MsmeExposureResponse>(`/analytics/msme/exposure/${bucket}`),
    enabled: !!bucket,
  });

export const useSavingsSummary = (p: AnalyticsPeriodKey) =>
  useAnalytics<SavingsSummaryResponse>('savings', 'savings/summary', p);
export const useBuyerLeaderboard = (p: AnalyticsPeriodKey, enabled: boolean) =>
  useQuery({
    queryKey: analyticsKeys.k('leaderboard', p),
    queryFn: () =>
      apiFetch<BuyerLeaderboardResponse>(`/analytics/savings/leaderboard${q(p)}`),
    enabled,
    retry: false,
  });

export const useApPerformance = (p: AnalyticsPeriodKey) =>
  useAnalytics<ApPerformanceResponse>('ap', 'ap-performance', p);
export const useRiskDistribution = () =>
  useAnalytics<RiskDistributionResponse>('risk', 'vendors/risk-distribution', 'LAST_12M');
export const useCategoryPerformance = () =>
  useAnalytics<CategoryPerformanceResponse>(
    'cat-perf',
    'vendors/category-performance',
    'LAST_12M',
  );
export const useMsmeParticipation = () =>
  useAnalytics<MsmeParticipationResponse>(
    'msme-part',
    'vendors/msme-participation',
    'LAST_12M',
  );

export function useRefreshAnalytics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<RefreshResponse>('/analytics/refresh', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: analyticsKeys.all }),
  });
}

export function useLogAvoidedCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      baselineValue: string;
      awardedValue: string;
      notes: string;
      vendorId?: string;
      category?: string;
    }) =>
      apiFetch<{ id: string }>('/analytics/savings/avoided-cost', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: analyticsKeys.all }),
  });
}

export const msmeReportUrl = (): string => `${API_URL}/analytics/msme/report.pdf`;

// ── Rebuilt Analytics page (overview + three sections) ──────────────────────

/** Period filter as it appears in the URL: a preset, or CUSTOM with from/to (YYYY-MM-DD). */
export interface AnalyticsRange {
  period: AnalyticsPeriodKey;
  from?: string;
  to?: string;
}

function rangeQuery(r: AnalyticsRange): string {
  const p = new URLSearchParams({ period: r.period });
  if (r.period === 'CUSTOM') {
    if (r.from) p.set('from', r.from);
    if (r.to) p.set('to', r.to);
  }
  return p.toString();
}

function useRangeAnalytics<T>(name: string, path: string, r: AnalyticsRange): UseQueryResult<T> {
  const qs = rangeQuery(r);
  return useQuery({
    queryKey: ['analytics', name, qs],
    queryFn: () => apiFetch<T>(`/analytics/${path}?${qs}`),
    staleTime: 60_000,
  });
}

export const useAnalyticsOverview = (r: AnalyticsRange) =>
  useRangeAnalytics<AnalyticsOverviewResponse>('overview', 'overview', r);
export const useSpendSavings = (r: AnalyticsRange) =>
  useRangeAnalytics<SpendSavingsResponse>('spend-savings', 'spend-savings', r);
export const useVelocity = (r: AnalyticsRange) =>
  useRangeAnalytics<VelocityResponse>('velocity', 'velocity', r);
export const useMsmeCompliance = (r: AnalyticsRange) =>
  useRangeAnalytics<MsmeComplianceResponse>('msme-compliance', 'msme/compliance', r);
/** Spend by category over a range (the existing endpoint, range-aware). */
export const useSpendByCategoryRange = (r: AnalyticsRange) =>
  useRangeAnalytics<SpendByCategoryResponse>('spend-category-range', 'spend/by-category', r);
