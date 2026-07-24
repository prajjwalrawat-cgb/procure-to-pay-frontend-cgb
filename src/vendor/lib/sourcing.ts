'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  QuoteCreateInput,
  QuoteUpdateInput,
  QuoteView,
  RfqDetailResponse,
  VendorRfqListResponse,
} from '@/lib/shared';

import { apiFetch } from '@/vendor/lib/api-client';

export const vendorSourcingKeys = {
  invitations: ['vendor-sourcing', 'invitations'] as const,
  rfq: (id: string) => ['vendor-sourcing', 'rfq', id] as const,
  quotes: ['vendor-sourcing', 'quotes'] as const,
  quote: (id: string) => ['vendor-sourcing', 'quote', id] as const,
};

export function useInvitedRfqs(): UseQueryResult<VendorRfqListResponse> {
  return useQuery({
    queryKey: vendorSourcingKeys.invitations,
    queryFn: () => apiFetch<VendorRfqListResponse>('/vendor/rfq'),
  });
}

export function useVendorRfq(id: string): UseQueryResult<RfqDetailResponse> {
  return useQuery({
    queryKey: vendorSourcingKeys.rfq(id),
    queryFn: () => apiFetch<RfqDetailResponse>(`/vendor/rfq/${id}`),
    enabled: !!id,
  });
}

export function useMyQuotes(): UseQueryResult<QuoteView[]> {
  return useQuery({
    queryKey: vendorSourcingKeys.quotes,
    queryFn: () => apiFetch<QuoteView[]>('/vendor/quotes'),
  });
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function useAcknowledge(
  id: string,
): ReturnType<typeof useMutation<{ ok: true }, Error, void>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post(`/vendor/rfq/${id}/acknowledge`),
    onSuccess: () => qc.invalidateQueries({ queryKey: vendorSourcingKeys.invitations }),
  });
}

export function useDecline(
  id: string,
): ReturnType<typeof useMutation<{ ok: true }, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => post(`/vendor/rfq/${id}/decline`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: vendorSourcingKeys.invitations }),
  });
}

export function useCreateQuote(): ReturnType<
  typeof useMutation<{ id: string }, Error, QuoteCreateInput>
> {
  return useMutation({
    mutationFn: (input: QuoteCreateInput) => post('/vendor/quotes', input),
  });
}

export function useUpdateQuote(
  id: string,
): ReturnType<typeof useMutation<{ ok: true }, Error, QuoteUpdateInput>> {
  return useMutation({
    mutationFn: (input: QuoteUpdateInput) =>
      apiFetch(`/vendor/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  });
}

export function useSubmitQuote(
  id: string,
): ReturnType<
  typeof useMutation<{ submissionHash: string; short: string }, Error, void>
> {
  return useMutation({ mutationFn: () => post(`/vendor/quotes/${id}/submit`) });
}
