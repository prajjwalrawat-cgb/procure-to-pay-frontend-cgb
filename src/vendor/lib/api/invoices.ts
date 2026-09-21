'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  InvoiceDocumentKind,
  TaxInvoiceInput,
  VendorInvoiceSubmitInput,
  VendorPoOption,
} from '@/lib/shared';

import { apiFetch } from '@/vendor/lib/api-client';

export interface VendorInvoiceSummary {
  id: string;
  number: string;
  vendorInvoiceRef: string;
  status: string;
  grossAmount: string;
  invoiceDate: string;
  documentKind: InvoiceDocumentKind;
  /** The PI this invoice started as, once its tax invoice replaced it. */
  proformaRef: string | null;
}

export interface VendorInvoiceDetail extends VendorInvoiceSummary {
  lines: {
    lineNo: number;
    poLineId: string | null;
    itemDesc: string;
    uom: string;
    qty: string;
    unitPrice: string;
    taxRate: string;
  }[];
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

export function useMyInvoice(id: string): UseQueryResult<VendorInvoiceDetail> {
  return useQuery({
    queryKey: ['vendor', 'invoices', id],
    queryFn: () => apiFetch<VendorInvoiceDetail>(`/vendor/invoices/${id}`),
  });
}

/**
 * Replace one of the vendor's proformas with its tax invoice. The file is
 * stored first, so a failed upload never leaves the invoice pointing at a
 * document that is not there.
 */
export function useAttachTaxInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { file: File; body: Omit<TaxInvoiceInput, 's3Key'> }) => {
      const s3Key = await uploadInvoiceFile(vars.file);
      return apiFetch<{ ok: true }>(`/vendor/invoices/${id}/tax-invoice`, {
        method: 'POST',
        body: JSON.stringify({ ...vars.body, s3Key }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor', 'invoices'] }),
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
