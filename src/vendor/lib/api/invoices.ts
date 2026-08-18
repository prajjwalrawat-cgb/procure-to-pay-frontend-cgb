'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { VendorInvoiceSubmitInput, VendorPoOption } from '@/lib/shared';

import { apiFetch } from '@/vendor/lib/api-client';

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

/**
 * Upload the tax invoice and get back the object key to submit with.
 *
 * This step used to be missing: the form invented an `s3Key` from the chosen
 * filename and sent that, so the document never left the browser and the
 * buyer's attachment link resolved to nothing.
 */
export async function uploadInvoiceFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const { s3Key } = await apiFetch<{ s3Key: string }>('/vendor/invoices/upload', {
    method: 'POST',
    body: form,
  });
  return s3Key;
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
