'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  SaveStepInput,
  VendorDocumentType,
  VendorDocumentUpload,
} from '@/lib/shared';

import { apiFetch } from '@/vendor/lib/api-client';

export interface WizardState {
  currentStep: number;
  completionPct: number;
  steps: Record<string, { done: boolean; data: Record<string, unknown> }>;
}
export interface UploadedDocument {
  id: string;
  docType: string;
  filename: string;
  sizeBytes: number;
  verificationStatus: string;
  uploadedAt: string;
  /** Presigned GET URL; '' when the object could not be signed. */
  url: string;
}

export interface ResumeResponse {
  vendorId: string;
  onboardingId: string;
  categoryKey: string;
  wizardState: WizardState;
  documents: UploadedDocument[];
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

export interface UploadedDocResult {
  id: string;
  s3Key: string;
  filename: string;
  sizeBytes: number;
  url: string;
}

/** Upload the vendor's actual file (multipart) — the API stores it in S3 and
 *  records the document. Replaces the placeholder-metadata flow. */
export function useUploadOnboardingDocFile(): ReturnType<
  typeof useMutation<
    UploadedDocResult,
    Error,
    { docType: VendorDocumentType; file: File }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docType, file }: { docType: VendorDocumentType; file: File }) => {
      const form = new FormData();
      form.append('docType', docType);
      form.append('file', file);
      return apiFetch<UploadedDocResult>('/vendor/onboarding/documents/upload', {
        method: 'POST',
        body: form,
      });
    },
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
