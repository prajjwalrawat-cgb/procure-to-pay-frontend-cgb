'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  ExceptionResolutionInput,
  InvoiceDetailResponse,
  InvoiceListResponse,
  InvoiceTab,
  InvoiceTabCounts,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (tab: InvoiceTab) => ['invoices', 'list', tab] as const,
  counts: () => ['invoices', 'counts'] as const,
  detail: (id: string) => ['invoices', 'detail', id] as const,
  ref: (kind: string, id: string) => ['refs', kind, id] as const,
};

export function useInvoices(tab: InvoiceTab): UseQueryResult<InvoiceListResponse> {
  return useQuery({
    queryKey: invoiceKeys.list(tab),
    queryFn: () => apiFetch<InvoiceListResponse>(`/invoices?tab=${tab}&limit=50`),
  });
}

export function useInvoiceCounts(): UseQueryResult<InvoiceTabCounts> {
  return useQuery({
    queryKey: invoiceKeys.counts(),
    queryFn: () => apiFetch<InvoiceTabCounts>('/invoices/counts'),
  });
}

export function useInvoice(id: string): UseQueryResult<InvoiceDetailResponse> {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => apiFetch<InvoiceDetailResponse>(`/invoices/${id}`),
  });
}

export function useResolveException(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { excId: string; body: ExceptionResolutionInput }) =>
      apiFetch(`/invoices/${invoiceId}/exceptions/${vars.excId}/resolve`, {
        method: 'POST',
        body: JSON.stringify(vars.body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
      void qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useResolveAndRoute(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/invoices/${invoiceId}/resolve-and-route`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useAddComment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/invoices/${invoiceId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) }),
  });
}

export interface RefCard {
  kind: string;
  [key: string]: unknown;
}

export function useRefCard(
  kind: string | null,
  id: string | null,
): UseQueryResult<RefCard> {
  return useQuery({
    queryKey: invoiceKeys.ref(kind ?? '', id ?? ''),
    queryFn: () => apiFetch<RefCard>(`/refs/${kind}/${id}`),
    enabled: Boolean(kind && id),
    staleTime: 5 * 60 * 1000,
  });
}
