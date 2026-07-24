'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  ApprovalDecisionAction,
  ApprovalSidebarCounts,
  InboxResponse,
} from '@procureflow/shared';

import { apiFetch } from '@/lib/api-client';

export type InboxFilterKey =
  'all' | 'waiting_on_me' | 'delegated_to_me' | 'delegated_by_me';

export const inboxKeys = {
  all: ['inbox'] as const,
  list: (filter: InboxFilterKey) => ['inbox', 'list', filter] as const,
  sidebar: () => ['inbox', 'sidebar'] as const,
};

export function useInbox(filter: InboxFilterKey): UseQueryResult<InboxResponse> {
  return useQuery({
    queryKey: inboxKeys.list(filter),
    queryFn: () => apiFetch<InboxResponse>(`/inbox?filter=${filter}`),
  });
}

export function useSidebarCounts(): UseQueryResult<ApprovalSidebarCounts> {
  return useQuery({
    queryKey: inboxKeys.sidebar(),
    queryFn: () => apiFetch<ApprovalSidebarCounts>('/inbox/sidebar'),
    refetchInterval: 60_000,
  });
}

export function useDecide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      approvalId: string;
      decision: ApprovalDecisionAction;
      comment?: string;
    }) =>
      apiFetch(`/approvals/${vars.approvalId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision: vars.decision, comment: vars.comment }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inboxKeys.all });
      void qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useBulkApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { approvalIds: string[]; comment?: string }) =>
      apiFetch<{ approved: number }>('/inbox/bulk-approve', {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: inboxKeys.all }),
  });
}

export function useDelegate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      approvalId: string;
      delegateToUserId: string;
      reason: string;
    }) =>
      apiFetch(`/approvals/${vars.approvalId}/delegate`, {
        method: 'POST',
        body: JSON.stringify({
          delegateToUserId: vars.delegateToUserId,
          reason: vars.reason,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inboxKeys.all });
      void qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
