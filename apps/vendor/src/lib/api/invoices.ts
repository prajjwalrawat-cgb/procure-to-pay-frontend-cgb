'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { VendorInvoiceSubmitInput, VendorPoOption } from '@procureflow/shared';

import { apiFetch } from '@/lib/api-client';

export interface VendorInvoiceSummary {
  id: string;
  number: string;
  vendorInvoiceRef: string;
  status: string;
  grossAmount: string;
  invoiceDate: string;
}

export function useOpenPos(): UseQueryResult<VendorPoOption[]> {
  return useQuery({
    queryKey: ['vendor', 'pos'],
    queryFn: () => apiFetch<VendorPoOption[]>('/vendor/pos'),
  });
}

export function useMyInvoices(): UseQueryResult<VendorInvoiceSummary[]> {
  return useQuery({
    queryKey: ['vendor', 'invoices'],
    queryFn: () => apiFetch<VendorInvoiceSummary[]>('/vendor/invoices'),
  });
}

export function useSubmitInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VendorInvoiceSubmitInput) =>
      apiFetch<{ id: string }>('/vendor/invoices', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor', 'invoices'] }),
  });
}
