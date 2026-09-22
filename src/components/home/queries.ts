'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  ApprovalSidebarCounts,
  GrnListResponse,
  InboxResponse,
  InvoiceListResponse,
  InvoiceTabCounts,
  PoListResponse,
  RequisitionKanbanResponse,
} from '@/lib/shared';

import { ApiError } from '@/lib/api-error';
import { apiFetch } from '@/lib/api-client';
import { inboxKeys } from '@/lib/api/inbox';
import { invoiceKeys } from '@/lib/api/invoices';
import { fetchAllPages, type AllPages } from '@/lib/api/paginate';
import { requisitionKeys } from '@/lib/api/requisitions';

/**
 * Read queries for the buyer home dashboard.
 *
 * Every one calls an endpoint a list screen already uses, and most share that
 * screen's query key so the home page warms the cache for wherever the user
 * clicks next. Unlike the list hooks they take `enabled`: the home page mixes
 * modules from every role, and a query the user's permissions would 403 should
 * not be sent at all. A 403 that slips through (permissions changed mid-session)
 * is not retried — the tile just hides.
 */

const noRetryOn403 = (count: number, e: Error): boolean =>
  !(e instanceof ApiError && (e.status === 403 || e.status === 401)) && count < 1;

export function isForbidden(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403;
}

export function useHomeApprovalCounts(enabled: boolean): UseQueryResult<ApprovalSidebarCounts> {
  return useQuery({
    queryKey: inboxKeys.sidebar(),
    queryFn: () => apiFetch<ApprovalSidebarCounts>('/inbox/sidebar'),
    enabled,
    retry: noRetryOn403,
  });
}

export function useHomeWaiting(enabled: boolean): UseQueryResult<InboxResponse> {
  return useQuery({
    queryKey: inboxKeys.list('waiting_on_me'),
    queryFn: () => apiFetch<InboxResponse>('/inbox?filter=waiting_on_me'),
    enabled,
    retry: noRetryOn403,
  });
}

export function useHomeInvoiceCounts(enabled: boolean): UseQueryResult<InvoiceTabCounts> {
  return useQuery({
    queryKey: invoiceKeys.counts(),
    queryFn: () => apiFetch<InvoiceTabCounts>('/invoices/counts'),
    enabled,
    retry: noRetryOn403,
  });
}

/** Open invoices from MSME suppliers — the same rows as the Invoices "MSME risk" tab. */
export function useHomeMsmeInvoices(
  enabled: boolean,
): UseQueryResult<AllPages<InvoiceListResponse>> {
  return useQuery({
    queryKey: invoiceKeys.list('msme'),
    queryFn: () => fetchAllPages<InvoiceListResponse>('/invoices?tab=msme'),
    enabled,
    retry: noRetryOn403,
  });
}

/** The PO list envelope carries per-tab counts; one row is enough to read them. */
export function useHomePoCounts(enabled: boolean): UseQueryResult<PoListResponse['counts']> {
  return useQuery({
    queryKey: ['purchase-orders', 'home-counts'],
    queryFn: async () =>
      (await apiFetch<PoListResponse>('/purchase-orders?tab=awaiting_grn&limit=1')).counts,
    enabled,
    retry: noRetryOn403,
  });
}

export function useHomeGrnCounts(enabled: boolean): UseQueryResult<GrnListResponse['counts']> {
  return useQuery({
    queryKey: ['receipts', 'home-counts'],
    queryFn: async () =>
      (await apiFetch<GrnListResponse>('/grn?tab=awaiting_qc&limit=1')).counts,
    enabled,
    retry: noRetryOn403,
  });
}

export function useHomeRequisitionBoard(
  enabled: boolean,
): UseQueryResult<RequisitionKanbanResponse> {
  return useQuery({
    queryKey: requisitionKeys.board(),
    queryFn: () => apiFetch<RequisitionKanbanResponse>('/requisitions/board'),
    enabled,
    retry: noRetryOn403,
  });
}
