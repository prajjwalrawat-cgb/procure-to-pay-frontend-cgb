'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  AwardRecommendInput,
  AwardView,
  ComparisonMatrixResponse,
  QuoteEvaluateInput,
  RfqCreateInput,
  RfqDetailResponse,
  RfqInvitationInput,
  RfqListResponse,
  RfqPublishInput,
} from '@procureflow/shared';

import { apiFetch } from '@/lib/api-client';

export type RfqTab =
  'active' | 'draft' | 'my_action' | 'evaluation' | 'awarded' | 'cancelled';

export const sourcingKeys = {
  all: ['sourcing'] as const,
  list: (tab: RfqTab) => ['sourcing', 'list', tab] as const,
  detail: (id: string) => ['sourcing', 'detail', id] as const,
  comparison: (id: string) => ['sourcing', 'comparison', id] as const,
  award: (rfqId: string, awardId: string) =>
    ['sourcing', 'award', rfqId, awardId] as const,
};

export function useRfqList(tab: RfqTab): UseQueryResult<RfqListResponse> {
  return useQuery({
    queryKey: sourcingKeys.list(tab),
    queryFn: () => apiFetch<RfqListResponse>(`/rfq?tab=${tab}&limit=50`),
  });
}

export function useRfq(id: string): UseQueryResult<RfqDetailResponse> {
  return useQuery({
    queryKey: sourcingKeys.detail(id),
    queryFn: () => apiFetch<RfqDetailResponse>(`/rfq/${id}`),
    enabled: !!id,
  });
}

export function useComparison(id: string): UseQueryResult<ComparisonMatrixResponse> {
  return useQuery({
    queryKey: sourcingKeys.comparison(id),
    queryFn: () => apiFetch<ComparisonMatrixResponse>(`/rfq/${id}/comparison`),
    enabled: !!id,
  });
}

export function useAward(rfqId: string, awardId: string): UseQueryResult<AwardView> {
  return useQuery({
    queryKey: sourcingKeys.award(rfqId, awardId),
    queryFn: () => apiFetch<AwardView>(`/rfq/${rfqId}/awards/${awardId}`),
    enabled: !!awardId,
  });
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function useCreateRfq(): ReturnType<
  typeof useMutation<{ id: string }, Error, RfqCreateInput>
> {
  return useMutation({ mutationFn: (input: RfqCreateInput) => post('/rfq', input) });
}

export function useInvite(
  id: string,
): ReturnType<typeof useMutation<{ added: number }, Error, RfqInvitationInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RfqInvitationInput) => post(`/rfq/${id}/invitations`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: sourcingKeys.detail(id) }),
  });
}

export function usePublish(
  id: string,
): ReturnType<typeof useMutation<{ status: string }, Error, RfqPublishInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RfqPublishInput) => post(`/rfq/${id}/publish`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: sourcingKeys.detail(id) }),
  });
}

export function useOpenEnvelope(
  id: string,
  envelope: 'technical' | 'commercial',
): ReturnType<typeof useMutation<{ opened: number }, Error, string[]>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantUserIds: string[]) =>
      post(`/rfq/${id}/open-${envelope}`, { participantUserIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sourcingKeys.detail(id) });
      qc.invalidateQueries({ queryKey: sourcingKeys.comparison(id) });
    },
  });
}

export function useQualify(
  id: string,
): ReturnType<
  typeof useMutation<
    { ok: true },
    Error,
    { quoteId: string; decision: 'QUALIFIED' | 'DISQUALIFIED'; notes?: string }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      quoteId: string;
      decision: 'QUALIFIED' | 'DISQUALIFIED';
      notes?: string;
    }) =>
      post(`/rfq/${id}/quotes/${v.quoteId}/qualify`, {
        decision: v.decision,
        notes: v.notes,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sourcingKeys.comparison(id) }),
  });
}

export function useAutoScore(
  id: string,
): ReturnType<typeof useMutation<{ scored: number }, Error, void>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post(`/rfq/${id}/auto-score`),
    onSuccess: () => qc.invalidateQueries({ queryKey: sourcingKeys.comparison(id) }),
  });
}

export function useEvaluate(
  id: string,
): ReturnType<
  typeof useMutation<{ ok: true }, Error, { quoteId: string; input: QuoteEvaluateInput }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { quoteId: string; input: QuoteEvaluateInput }) =>
      post(`/rfq/${id}/quotes/${v.quoteId}/evaluate`, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: sourcingKeys.comparison(id) }),
  });
}

export function useRecommendAward(
  id: string,
): ReturnType<typeof useMutation<{ id: string }, Error, AwardRecommendInput>> {
  return useMutation({
    mutationFn: (input: AwardRecommendInput) => post(`/rfq/${id}/awards`, input),
  });
}

export function useSubmitAward(
  id: string,
): ReturnType<typeof useMutation<{ ok: true }, Error, string>> {
  return useMutation({
    mutationFn: (awardId: string) => post(`/rfq/${id}/awards/${awardId}/submit`),
  });
}
