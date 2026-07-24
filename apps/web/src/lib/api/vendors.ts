'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  BlacklistVendorInput,
  InviteVendorInput,
  OnboardingDetailResponse,
  OnboardingListResponse,
  SuspendVendorInput,
  Vendor360Response,
  VendorListResponse,
} from '@procureflow/shared';

import { apiFetch } from '@/lib/api-client';

export type VendorTab =
  'active' | 'onboarding' | 'suspended' | 'blacklisted' | 'archived' | 'all';
export type OnboardingTab = 'all' | 'in_progress' | 'my_review' | 'approved' | 'rejected';

export const vendorKeys = {
  all: ['vendors'] as const,
  list: (tab: VendorTab) => ['vendors', 'list', tab] as const,
  onboardingQueue: (tab: OnboardingTab) => ['vendors', 'onboarding', tab] as const,
  onboardingDetail: (id: string) => ['vendors', 'onboarding', 'detail', id] as const,
  vendor360: (id: string) => ['vendors', '360', id] as const,
};

export function useVendorList(tab: VendorTab): UseQueryResult<VendorListResponse> {
  return useQuery({
    queryKey: vendorKeys.list(tab),
    queryFn: () => apiFetch<VendorListResponse>(`/vendors?tab=${tab}&limit=100`),
  });
}

export function useOnboardingQueue(
  tab: OnboardingTab,
): UseQueryResult<OnboardingListResponse> {
  return useQuery({
    queryKey: vendorKeys.onboardingQueue(tab),
    queryFn: () =>
      apiFetch<OnboardingListResponse>(`/vendors/onboarding?tab=${tab}&limit=100`),
  });
}

export function useOnboardingDetail(
  id: string,
): UseQueryResult<OnboardingDetailResponse> {
  return useQuery({
    queryKey: vendorKeys.onboardingDetail(id),
    queryFn: () => apiFetch<OnboardingDetailResponse>(`/vendors/onboarding/${id}`),
    enabled: !!id,
  });
}

export function useVendor360(id: string): UseQueryResult<Vendor360Response> {
  return useQuery({
    queryKey: vendorKeys.vendor360(id),
    queryFn: () => apiFetch<Vendor360Response>(`/vendors/${id}`),
    enabled: !!id,
  });
}

export function useInviteVendor(): ReturnType<
  typeof useMutation<{ vendorId: string; onboardingId: string }, Error, InviteVendorInput>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteVendorInput) =>
      apiFetch<{ vendorId: string; onboardingId: string }>(`/vendors/invite`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: vendorKeys.all }),
  });
}

export function useOnboardingDecision(
  onboardingId: string,
): ReturnType<
  typeof useMutation<
    { ok: true },
    Error,
    { approvalId: string; decision: 'APPROVE' | 'REJECT' | 'CHANGES'; comment?: string }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      approvalId: string;
      decision: 'APPROVE' | 'REJECT' | 'CHANGES';
      comment?: string;
    }) =>
      apiFetch<{ ok: true }>(`/vendors/onboarding/${onboardingId}/decision`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: vendorKeys.all }),
  });
}

export function useReturnForInfo(
  onboardingId: string,
): ReturnType<
  typeof useMutation<{ ok: true }, Error, { items: string[]; note?: string }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { items: string[]; note?: string }) =>
      apiFetch<{ ok: true }>(`/vendors/onboarding/${onboardingId}/return`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: vendorKeys.onboardingDetail(onboardingId) }),
  });
}

export function useVerifyDocument(
  onboardingId: string,
): ReturnType<
  typeof useMutation<
    { ok: true },
    Error,
    { docId: string; decision: 'VERIFIED' | 'REJECTED'; reason?: string }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      docId: string;
      decision: 'VERIFIED' | 'REJECTED';
      reason?: string;
    }) =>
      apiFetch<{ ok: true }>(`/vendors/documents/${input.docId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ decision: input.decision, reason: input.reason ?? null }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: vendorKeys.onboardingDetail(onboardingId) }),
  });
}

export function useReviewScreening(onboardingId: string): ReturnType<
  typeof useMutation<
    { ok: true },
    Error,
    {
      screeningId: string;
      decision: 'CLEAR' | 'ACCEPT_RISK' | 'REJECT_VENDOR';
      notes?: string;
    }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      screeningId: string;
      decision: 'CLEAR' | 'ACCEPT_RISK' | 'REJECT_VENDOR';
      notes?: string;
    }) =>
      apiFetch<{ ok: true }>(`/vendors/screenings/${input.screeningId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision: input.decision, notes: input.notes ?? null }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: vendorKeys.onboardingDetail(onboardingId) }),
  });
}

export function useSuspendVendor(
  vendorId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, SuspendVendorInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SuspendVendorInput) =>
      apiFetch<{ id: string }>(`/vendors/${vendorId}/suspend`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: vendorKeys.all }),
  });
}

export function useBlacklistVendor(
  vendorId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, BlacklistVendorInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BlacklistVendorInput) =>
      apiFetch<{ id: string }>(`/vendors/${vendorId}/blacklist`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: vendorKeys.all }),
  });
}
