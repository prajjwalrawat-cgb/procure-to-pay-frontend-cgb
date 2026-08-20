'use client';

import type {
  Branch,
  BranchInput,
  CustomFieldCreateInput,
  CustomFieldDefinition,
  CustomFieldEntity,
  CustomFieldUpdateInput,
  CustomFieldValues,
  OrganisationSettings,
  OrganisationUpdateInput,
  VendorCategory,
  VendorCategoryCreateInput,
  VendorCategoryOption,
  VendorCategoryUpdateInput,
} from '@/lib/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export const settingsKeys = {
  all: ['settings'] as const,
  organisation: ['settings', 'organisation'] as const,
  customFields: ['settings', 'custom-fields'] as const,
  formFields: (entity: CustomFieldEntity) => ['settings', 'form-fields', entity] as const,
  vendorCategories: ['settings', 'vendor-categories'] as const,
  vendorCategoryOptions: ['settings', 'vendor-categories', 'options'] as const,
};

export const useOrganisationSettings = () =>
  useQuery({
    queryKey: settingsKeys.organisation,
    queryFn: () => apiFetch<OrganisationSettings>('/settings/organisation'),
  });

export function useUpdateOrganisation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OrganisationUpdateInput) =>
      apiFetch<OrganisationSettings>('/settings/organisation', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(settingsKeys.organisation, data);
      // The org name rides in the session (page subheadings read it), so the
      // profile has to be re-read for a rename to show without a reload.
      void qc.invalidateQueries({ queryKey: ['users', 'me'] });
    },
  });
}

/** Multipart, so no JSON Content-Type: `apiFetch` detects FormData. */
export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiFetch<OrganisationSettings>('/settings/organisation/logo', {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: (data) => qc.setQueryData(settingsKeys.organisation, data),
  });
}

// ── GST registrations (branches) ───────────────────────────────────────────

/** Branch mutations all return the full list, so the cache is replaced whole. */
function useBranchMutation<TArgs>(fn: (args: TArgs) => Promise<Branch[]>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (branches) => {
      qc.setQueryData<OrganisationSettings>(settingsKeys.organisation, (prev) =>
        prev ? { ...prev, branches } : prev,
      );
      // Branch state drives the place of supply on new documents.
      void qc.invalidateQueries({ queryKey: ['refs', 'plants'] });
    },
  });
}

export const useCreateBranch = () =>
  useBranchMutation((body: BranchInput) =>
    apiFetch<Branch[]>('/settings/branches', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );

export const useUpdateBranch = () =>
  useBranchMutation((v: { id: string; body: BranchInput }) =>
    apiFetch<Branch[]>(`/settings/branches/${v.id}`, {
      method: 'PUT',
      body: JSON.stringify(v.body),
    }),
  );

export const useSetDefaultBranch = () =>
  useBranchMutation((id: string) =>
    apiFetch<Branch[]>(`/settings/branches/${id}/default`, { method: 'POST' }),
  );

// ── Custom fields ──────────────────────────────────────────────────────────

/** Every definition in the tenant, for the admin screen. */
export const useCustomFields = () =>
  useQuery({
    queryKey: settingsKeys.customFields,
    queryFn: () => apiFetch<CustomFieldDefinition[]>('/settings/custom-fields'),
  });

/** The active definitions a form should render for one document type. */
export const useFormFields = (entity: CustomFieldEntity) =>
  useQuery({
    queryKey: settingsKeys.formFields(entity),
    queryFn: () =>
      apiFetch<CustomFieldDefinition[]>(`/settings/custom-fields/for/${entity}`),
  });

/**
 * Persists captured values after a document is created or saved.
 *
 * Values ride on their own route rather than inside each document's create
 * payload: the field list is tenant data, so one generic write path serves
 * every document type. Never throws into the caller's success path — a custom
 * field failing to save must not make a saved requisition look unsaved.
 */
export async function saveCustomFieldValues(
  entity: CustomFieldEntity,
  documentId: string,
  values: CustomFieldValues,
): Promise<void> {
  if (Object.keys(values).length === 0) return;
  try {
    await apiFetch(`/custom-fields/values/${entity}/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify(values),
    });
  } catch {
    // Surfaced by the document page, which re-reads the saved values.
  }
}

/** Values captured on one document. */
export const useCustomFieldValues = (entity: CustomFieldEntity, documentId: string) =>
  useQuery({
    queryKey: ['custom-field-values', entity, documentId],
    queryFn: () =>
      apiFetch<{ values: CustomFieldValues }>(
        `/custom-fields/values/${entity}/${documentId}`,
      ),
    enabled: !!documentId,
  });

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomFieldCreateInput) =>
      apiFetch<CustomFieldDefinition>('/settings/custom-fields', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: CustomFieldUpdateInput }) =>
      apiFetch<CustomFieldDefinition>(`/settings/custom-fields/${v.id}`, {
        method: 'PATCH',
        body: JSON.stringify(v.body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

// ── Vendor categories ──────────────────────────────────────────────────────

/** Every category in the tenant, retired ones included — the admin screen. */
export const useVendorCategories = () =>
  useQuery({
    queryKey: settingsKeys.vendorCategories,
    queryFn: () => apiFetch<VendorCategory[]>('/settings/vendor-categories'),
  });

/**
 * The categories a dropdown should offer. Needs no settings permission — the
 * buyer inviting a vendor and the vendor filling in the wizard both read it.
 */
export const useVendorCategoryOptions = () =>
  useQuery({
    queryKey: settingsKeys.vendorCategoryOptions,
    queryFn: () =>
      apiFetch<VendorCategoryOption[]>('/settings/vendor-categories/options'),
    staleTime: 5 * 60_000,
  });

export function useCreateVendorCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VendorCategoryCreateInput) =>
      apiFetch<VendorCategory>('/settings/vendor-categories', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

export function useUpdateVendorCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: VendorCategoryUpdateInput }) =>
      apiFetch<VendorCategory>(`/settings/vendor-categories/${v.id}`, {
        method: 'PATCH',
        body: JSON.stringify(v.body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}
