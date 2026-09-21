'use client';

import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type UseQueryResult,
  type InfiniteData,
} from '@tanstack/react-query';
import type {
  ActivityResponse,
  ApprovalPipelineResponse,
  HomeSummaryResponse,
  UpcomingPaymentRunsResponse,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';

/**
 * Home command-center reads. All four endpoints need `analytics:read`; callers
 * gate on that permission (`enabled`) so a role without it sends nothing that
 * would 403. The server refreshes its daily rollup when it is over 5 minutes
 * old, so polling faster than that only re-reads the same numbers.
 */
export const homeKeys = {
  all: ['home'] as const,
  summary: () => ['home', 'summary'] as const,
  activity: () => ['home', 'activity'] as const,
  pipeline: () => ['home', 'pipeline'] as const,
  upcomingRuns: () => ['home', 'upcoming-runs'] as const,
};

const FIVE_MIN = 5 * 60_000;

export function useHomeSummary(enabled: boolean): UseQueryResult<HomeSummaryResponse> {
  return useQuery({
    queryKey: homeKeys.summary(),
    queryFn: () => apiFetch<HomeSummaryResponse>('/home/summary'),
    enabled,
    staleTime: FIVE_MIN,
    refetchInterval: FIVE_MIN,
  });
}

/** Newest first; `fetchNextPage` loads older events. Polls every 45s for new ones. */
export function useHomeActivity(
  enabled: boolean,
): UseInfiniteQueryResult<InfiniteData<ActivityResponse>> {
  return useInfiniteQuery({
    queryKey: homeKeys.activity(),
    queryFn: ({ pageParam }) =>
      apiFetch<ActivityResponse>(
        `/home/activity?limit=20${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled,
    refetchInterval: 45_000,
  });
}

export function useApprovalPipeline(enabled: boolean): UseQueryResult<ApprovalPipelineResponse> {
  return useQuery({
    queryKey: homeKeys.pipeline(),
    queryFn: () => apiFetch<ApprovalPipelineResponse>('/home/approval-pipeline'),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpcomingPaymentRuns(
  enabled: boolean,
): UseQueryResult<UpcomingPaymentRunsResponse> {
  return useQuery({
    queryKey: homeKeys.upcomingRuns(),
    queryFn: () => apiFetch<UpcomingPaymentRunsResponse>('/home/upcoming-payment-runs'),
    enabled,
    staleTime: 60_000,
  });
}
