'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  DocumentExtractionResult,
  SaveStepInput,
  VendorCategoryOption,
  VendorDocumentType,
  VendorDocumentUpload,
} from '@/lib/shared';

import { apiFetch } from '@/vendor/lib/api-client';
import type { WizardState } from './wizard-hydrate';

// Pure form-rebuilding logic lives apart from these network hooks so it can be
// unit-tested without pulling in the api client.
export {
  applyExtractedFields,
  hydrateWizardForm,
  replaceIdentityFields,
  withoutIdentityFields,
} from './wizard-hydrate';
export type { HydratedWizard, WizardState } from './wizard-hydrate';

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
  /** Vendor lifecycle — 'ACTIVE' means onboarding is already approved. */
  lifecycleStatus: string;
  submittedAt: string | null;
  reviewDecision: string | null;
  reviewNotes: string | null;
  /** Server's verdict on whether the wizard may still be edited and submitted.
   *  False once approved or while a submission is awaiting review. */
  editable: boolean;
}

export const onboardingKeys = {
  resume: ['onboarding', 'resume'] as const,
  categories: ['onboarding', 'categories'] as const,
};

export function useOnboarding(): UseQueryResult<ResumeResponse> {
  return useQuery({
    queryKey: onboardingKeys.resume,
    queryFn: () => apiFetch<ResumeResponse>('/vendor/onboarding'),
    retry: false,
  });
}

/**
 * The buyer's own vendor categories (they maintain them in Settings), so the
 * wizard can name the documents this vendor's category expects instead of
 * reading a list compiled into the app.
 */
export function useCategoryOptions(): UseQueryResult<VendorCategoryOption[]> {
  return useQuery({
    queryKey: onboardingKeys.categories,
    queryFn: () => apiFetch<VendorCategoryOption[]>('/settings/vendor-categories/options'),
    staleTime: 5 * 60_000,
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
  /** Set for the GST certificate and PAN card: the fields read off the document
   *  and what corroborates each. Null for documents that are filed, not parsed. */
  extraction?: DocumentExtractionResult | null;
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

/** IFSC → bank/branch. Called as the vendor types, so the bank name they can
 *  see is the directory's, not their memory of it. Null = unknown code. */
export async function lookupIfsc(ifsc: string): Promise<IfscLookupResult | null> {
  return apiFetch<IfscLookupResult | null>(
    `/vendor/onboarding/ifsc/${encodeURIComponent(ifsc)}`,
  );
}

export interface IfscLookupResult {
  ifsc: string;
  bank: string;
  branch: string | null;
  city: string | null;
  state: string | null;
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
