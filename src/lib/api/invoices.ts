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
  InvoiceDocumentKind,
  InvoiceTabCounts,
  RecordManualPaymentInput,
  ResolveAndRouteResult,
  TaxInvoiceInput,
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

/**
 * Statuses an invoice only passes through — OCR is queued, so the page is open
 * before the worker has extracted anything or run the 3-way match. Nothing
 * pushes that result to the browser, so the query polls itself until the
 * pipeline settles (OCR_DONE, MATCH_EXCEPTION, or a manual-review state) and
 * then stops. Without this the exceptions appear only on a manual refresh.
 */
const PIPELINE_IN_FLIGHT = ['RECEIVED', 'OCR_PENDING'];
const PIPELINE_POLL_MS = 3000;

export function useInvoice(id: string): UseQueryResult<InvoiceDetailResponse> {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => apiFetch<InvoiceDetailResponse>(`/invoices/${id}`),
    refetchInterval: (query) =>
      PIPELINE_IN_FLIGHT.includes(query.state.data?.status ?? '')
        ? PIPELINE_POLL_MS
        : false,
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

/**
 * Record a payment made outside the app — a direct transfer or cheque — in
 * full or in part. The next payment run then offers only what is left.
 */
export function useRecordPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecordManualPaymentInput) =>
      apiFetch<{ status: 'PAID' | 'PARTIALLY_PAID' }>(`/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useResolveAndRoute(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<ResolveAndRouteResult>(`/invoices/${invoiceId}/resolve-and-route`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

/**
 * Re-queue extraction for an invoice stuck before the matcher ever ran.
 *
 * The OCR job is enqueued once, at creation, so an invoice whose job is lost
 * has no route back on its own — and no screen offered one until this existed.
 */
export function useRetryOcr(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/invoices/${invoiceId}/ocr/retry`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

/**
 * Re-evaluate an invoice against the PO and goods receipt.
 *
 * Needed whenever the inputs moved after the last run — a goods receipt was
 * posted, a sibling invoice was rejected, or the matcher's own rules changed.
 * Exceptions are reconciled rather than duplicated, and resolved ones stay
 * resolved, so running it again is safe.
 */
export function useRunMatch(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/invoices/${invoiceId}/match/run`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

/** Say whether the document on the invoice is a proforma or a tax invoice. */
export function useSetDocumentKind(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: InvoiceDocumentKind) =>
      apiFetch(`/invoices/${invoiceId}/document-kind`, {
        method: 'POST',
        body: JSON.stringify({ kind }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

/**
 * Replace a proforma with its tax invoice: store the file, then attach it with
 * the header and lines. The file goes first so a failed upload never leaves the
 * record pointing at a document that is not there.
 */
export function useAttachTaxInvoice(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { file: File; body: Omit<TaxInvoiceInput, 's3Key'> }) => {
      const form = new FormData();
      form.append('file', vars.file);
      const { s3Key } = await apiFetch<{ s3Key: string }>(
        `/invoices/${invoiceId}/tax-invoice/file`,
        { method: 'POST', body: form },
      );
      return apiFetch(`/invoices/${invoiceId}/tax-invoice`, {
        method: 'POST',
        body: JSON.stringify({ ...vars.body, s3Key }),
      });
    },
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
