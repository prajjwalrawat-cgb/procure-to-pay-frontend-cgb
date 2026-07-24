'use client';

import type {
  CompleteManualEntry,
  CredentialStatusItem,
  Gstr2bReconResult,
  InboundEmailListResponse,
  IntegrationUsageResponse,
  IrnValidationResult,
  SetCredential,
} from '@procureflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export const integrationKeys = {
  all: ['integrations'] as const,
  credentials: ['integrations', 'credentials'] as const,
  usage: (month: string) => ['integrations', 'usage', month] as const,
  inbound: (status: string) => ['integrations', 'inbound', status] as const,
};

export const useCredentialStatus = () =>
  useQuery({
    queryKey: integrationKeys.credentials,
    queryFn: () => apiFetch<CredentialStatusItem[]>('/integrations/credentials'),
  });

export const useIntegrationUsage = (month: string) =>
  useQuery({
    queryKey: integrationKeys.usage(month),
    queryFn: () =>
      apiFetch<IntegrationUsageResponse>(`/integrations/usage?month=${month}`),
  });

export const useInboundEmails = (status?: string) =>
  useQuery({
    queryKey: integrationKeys.inbound(status ?? 'all'),
    queryFn: () =>
      apiFetch<InboundEmailListResponse>(
        `/invoices/inbound-emails${status ? `?status=${status}` : ''}`,
      ),
  });

export function useSetCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetCredential) =>
      apiFetch<{ ok: true }>('/integrations/credentials', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: integrationKeys.credentials }),
  });
}

export function useResolveVendorMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; vendorId: string }) =>
      apiFetch<{ status: string; invoiceId: string | null }>(
        `/invoices/inbound-emails/${v.id}/resolve`,
        { method: 'POST', body: JSON.stringify({ vendorId: v.vendorId }) },
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: integrationKeys.all }),
  });
}

export function useCompleteManualEntry(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CompleteManualEntry) =>
      apiFetch<{ ok: true }>(`/invoices/${invoiceId}/complete-manual-entry`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useRunGstr2b() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<Gstr2bReconResult>('/compliance/gstr2b/reconcile', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useValidateIrn(invoiceId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<IrnValidationResult>(`/compliance/invoices/${invoiceId}/validate-irn`, {
        method: 'POST',
      }),
  });
}
