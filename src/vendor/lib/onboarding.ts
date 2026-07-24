'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { SaveStepInput, VendorDocumentUpload } from '@/lib/shared';

import { apiFetch } from '@/vendor/lib/api-client';

export interface WizardState {
  currentStep: number;
  completionPct: number;
  steps: Record<string, { done: boolean; data: Record<string, unknown> }>;
}
export interface ResumeResponse {
  vendorId: string;
  onboardingId: string;
  wizardState: WizardState;
}

export const onboardingKeys = {
  resume: ['onboarding', 'resume'] as const,
};

export function useOnboarding(): UseQueryResult<ResumeResponse> {
  return useQuery({
    queryKey: onboardingKeys.resume,
    queryFn: () => apiFetch<ResumeResponse>('/vendor/onboarding'),
    retry: false,
  });
}

export function useSaveStep(): ReturnType<
  typeof useMutation<{ ok: true }, Error, { stepNumber: number; data: SaveStepInput }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stepNumber, data }: { stepNumber: number; data: SaveStepInput }) =>
      apiFetch<{ ok: true }>(`/vendor/onboarding/steps/${stepNumber}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: onboardingKeys.resume }),
  });
}

export function useUploadOnboardingDoc(): ReturnType<
  typeof useMutation<{ id: string }, Error, VendorDocumentUpload>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VendorDocumentUpload) =>
      apiFetch<{ id: string }>('/vendor/onboarding/documents', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: onboardingKeys.resume }),
  });
}

export function useAcknowledgeCoc(): ReturnType<
  typeof useMutation<{ ok: true }, Error, { name: string; designation: string }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; designation: string }) =>
      apiFetch<{ ok: true }>('/vendor/onboarding/coc', {
        method: 'POST',
        body: JSON.stringify({ ...input, agreed: true }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: onboardingKeys.resume }),
  });
}

export function useSubmitOnboarding(): ReturnType<
  typeof useMutation<{ ok: true }, Error, void>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>('/vendor/onboarding/submit', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: onboardingKeys.resume }),
  });
}
