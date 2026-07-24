'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  roles: string[];
  isActive: boolean;
  createdAt: string;
}

export interface InviteMemberInput {
  email: string;
  name: string;
  roles: string[];
}

export interface PendingInvite {
  id: string;
  email: string;
  name: string;
  roles: string[];
  invitedAt: string;
}

/** Buyer/internal roles an admin can assign (mirrors backend INVITABLE_ROLES —
 *  SYSADMIN and VENDOR_USER are intentionally excluded). */
export const ASSIGNABLE_ROLES: { value: string; label: string; description: string }[] = [
  { value: 'TENANT_ADMIN', label: 'Admin', description: 'Manages users, approval matrix, integrations' },
  { value: 'REQUESTER', label: 'Requester', description: 'Creates purchase requisitions' },
  { value: 'DEPT_HEAD', label: 'Department Head', description: 'Approves PRs at department level' },
  { value: 'PROCUREMENT_OFFICER', label: 'Procurement Officer', description: 'RFQ, sourcing, PO creation' },
  { value: 'PROCUREMENT_HEAD', label: 'Procurement Head', description: 'Approves POs above dept threshold' },
  { value: 'PLANT_HEAD', label: 'Plant Head', description: 'Approves plant-level POs / invoices' },
  { value: 'FINANCE_OFFICER', label: 'Finance Officer', description: 'Processes invoices, payment runs' },
  { value: 'FINANCE_HEAD', label: 'Finance Head', description: 'Approves payment runs / high-value invoices' },
  { value: 'STORES_OFFICER', label: 'Stores Officer', description: 'Creates goods receipts (GRNs)' },
  { value: 'QC_OFFICER', label: 'QC Officer', description: 'QC pass/fail on receipts' },
  { value: 'LEGAL_OFFICER', label: 'Legal Officer', description: 'Contract review, clause approval' },
  { value: 'MD', label: 'Managing Director', description: 'Approves above CFO threshold' },
  { value: 'AUDITOR', label: 'Auditor', description: 'Read-only across finance + procurement' },
];

const ROLE_LABELS = new Map(ASSIGNABLE_ROLES.map((r) => [r.value, r.label]));

/** Friendly label for a role name (falls back to the raw name). */
export function roleLabel(role: string): string {
  return ROLE_LABELS.get(role) ?? role;
}

export const teamKeys = {
  all: ['team'] as const,
  list: () => ['team', 'list'] as const,
  pending: () => ['team', 'pending'] as const,
};

export function useTeam(): UseQueryResult<TeamMember[]> {
  return useQuery({
    queryKey: teamKeys.list(),
    queryFn: () => apiFetch<TeamMember[]>('/users'),
  });
}

export function usePendingInvites(): UseQueryResult<PendingInvite[]> {
  return useQuery({
    queryKey: teamKeys.pending(),
    queryFn: () => apiFetch<PendingInvite[]>('/users/pending'),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/users/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteMemberInput) =>
      apiFetch<TeamMember>('/users/invite', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) =>
      apiFetch<TeamMember>(`/users/${id}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  });
}
