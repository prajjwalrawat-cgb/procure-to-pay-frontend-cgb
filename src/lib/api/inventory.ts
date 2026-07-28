'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  AdjustmentInput,
  CustomerReturnInput,
  DamageWriteOffInput,
  ImportBatchDetailResponse,
  ImportBatchListResponse,
  ImportRowResolve,
  IssueCreateInput,
  IssueReturnInput,
  LedgerQuery,
  LedgerResponse,
  LocationCreateInput,
  LocationListResponse,
  LocationUpdateInput,
  OrderFulfillInput,
  PendingDispositionResponse,
  ProductCreateInput,
  ProductDetailResponse,
  ProductListQuery,
  ProductListResponse,
  ProductStockResponse,
  ReceiptCreateInput,
  ReceiptQcInput,
  RestockDecisionInput,
  VendorReturnInput,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';

export const inventoryKeys = {
  all: ['inventory'] as const,
  products: (q: Partial<ProductListQuery>) => ['inventory', 'products', q] as const,
  product: (id: string) => ['inventory', 'product', id] as const,
  stock: (id: string) => ['inventory', 'stock', id] as const,
  locations: ['inventory', 'locations'] as const,
  ledger: (q: Partial<LedgerQuery>) => ['inventory', 'ledger', q] as const,
  pending: ['inventory', 'pending-dispositions'] as const,
  imports: ['inventory', 'imports'] as const,
  importBatch: (id: string) => ['inventory', 'imports', id] as const,
};

/** Drop null/undefined/empty params so the query string stays readable. */
function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ══════════════════════ Products & stock ══════════════════════

export function useProducts(
  query: Partial<ProductListQuery> = {},
): UseQueryResult<ProductListResponse> {
  return useQuery({
    queryKey: inventoryKeys.products(query),
    queryFn: () => apiFetch<ProductListResponse>(`/inventory/products${qs(query)}`),
  });
}

export function useProduct(id: string | null): UseQueryResult<ProductDetailResponse> {
  return useQuery({
    queryKey: inventoryKeys.product(id ?? ''),
    queryFn: () => apiFetch<ProductDetailResponse>(`/inventory/products/${id}`),
    enabled: !!id,
  });
}

export function useProductStock(id: string | null): UseQueryResult<ProductStockResponse> {
  return useQuery({
    queryKey: inventoryKeys.stock(id ?? ''),
    queryFn: () => apiFetch<ProductStockResponse>(`/inventory/products/${id}/stock`),
    enabled: !!id,
  });
}

export function useLocations(): UseQueryResult<LocationListResponse> {
  return useQuery({
    queryKey: inventoryKeys.locations,
    queryFn: () => apiFetch<LocationListResponse>('/inventory/locations'),
  });
}

export function useLedger(query: Partial<LedgerQuery> = {}): UseQueryResult<LedgerResponse> {
  return useQuery({
    queryKey: inventoryKeys.ledger(query),
    queryFn: () => apiFetch<LedgerResponse>(`/inventory/ledger${qs(query)}`),
  });
}

export function usePendingDispositions(): UseQueryResult<PendingDispositionResponse> {
  return useQuery({
    queryKey: inventoryKeys.pending,
    queryFn: () => apiFetch<PendingDispositionResponse>('/inventory/pending-dispositions'),
  });
}

// ══════════════════════ Mutations ══════════════════════

/**
 * Every movement invalidates the whole inventory tree: a single ledger row can
 * change a product's stock, its location breakdown, the ledger list and the
 * pending queues at once, so narrower invalidation just leaves stale panels.
 */
function useInventoryMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useCreateProduct() {
  return useInventoryMutation((body: ProductCreateInput) =>
    apiFetch<{ id: string; code: string }>('/inventory/products', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

export function useCreateLocation() {
  return useInventoryMutation((body: LocationCreateInput) =>
    apiFetch<{ id: string }>('/inventory/locations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

export function useUpdateLocation() {
  return useInventoryMutation(({ id, ...body }: LocationUpdateInput & { id: string }) =>
    apiFetch<{ ok: true }>(`/inventory/locations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  );
}

/** Retire a location. The API refuses while it still holds stock. */
export function useDeactivateLocation() {
  return useInventoryMutation((id: string) =>
    apiFetch<{ ok: true }>(`/inventory/locations/${id}/deactivate`, { method: 'POST' }),
  );
}

export function useReceiveStock() {
  return useInventoryMutation((body: ReceiptCreateInput) =>
    apiFetch<{ id: string }>('/inventory/receipts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

export function useRecordQc() {
  return useInventoryMutation(({ id, ...body }: ReceiptQcInput & { id: string }) =>
    apiFetch<{ ok: true; dispositionEntryId: string | null }>(
      `/inventory/receipts/${id}/qc`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  );
}

export function useVendorReturn() {
  return useInventoryMutation((body: VendorReturnInput) =>
    apiFetch<{ id: string }>('/inventory/vendor-returns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

export function useCreateIssue() {
  return useInventoryMutation((body: IssueCreateInput) =>
    apiFetch<{ id: string }>('/inventory/issues', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

export function useReturnIssue() {
  return useInventoryMutation(({ id, ...body }: IssueReturnInput & { id: string }) =>
    apiFetch<{ id: string; balanceQty: number; status: 'OPEN' | 'CLOSED' }>(
      `/inventory/issues/${id}/return`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  );
}

export function useFulfillOrder() {
  return useInventoryMutation((body: OrderFulfillInput) =>
    apiFetch<{ id: string }>('/inventory/orders/fulfill', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

export function useCustomerReturn() {
  return useInventoryMutation((body: CustomerReturnInput) =>
    apiFetch<{ id: string }>('/inventory/returns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

export function useRestockDecision() {
  return useInventoryMutation(({ id, ...body }: RestockDecisionInput & { id: string }) =>
    apiFetch<{ ok: true; writeOffEntryId: string | null }>(
      `/inventory/returns/${id}/restock-decision`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  );
}

export function useWriteOffDamage() {
  return useInventoryMutation((body: DamageWriteOffInput) =>
    apiFetch<{ id: string }>('/inventory/damage', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

export function useAdjustStock() {
  return useInventoryMutation((body: AdjustmentInput) =>
    apiFetch<{ id: string }>('/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

// ══════════════════════ Bulk import ══════════════════════

export function useImportBatches(): UseQueryResult<ImportBatchListResponse> {
  return useQuery({
    queryKey: inventoryKeys.imports,
    queryFn: () => apiFetch<ImportBatchListResponse>('/inventory/bulk-imports'),
  });
}

/**
 * Poll a running batch so the progress view updates live while the background
 * job works, then stop once it settles.
 */
export function useImportBatch(
  id: string | null,
  opts: { status?: string | null } = {},
): UseQueryResult<ImportBatchDetailResponse> {
  return useQuery({
    queryKey: [...inventoryKeys.importBatch(id ?? ''), opts.status ?? 'all'],
    queryFn: () =>
      apiFetch<ImportBatchDetailResponse>(
        `/inventory/bulk-imports/${id}${qs({ status: opts.status, limit: 200 })}`,
      ),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === 'PROCESSING' ? 2_000 : false,
  });
}

export function useUploadImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      importType,
      sheetName,
    }: {
      file: File;
      importType: string;
      /** Optional: pin a worksheet instead of letting detection choose. */
      sheetName?: string;
    }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('importType', importType);
      if (sheetName) form.append('sheetName', sheetName);
      return apiFetch<{
        batchId: string;
        totalRows: number;
        queued: boolean;
        sheetName: string | null;
        headerRowNumber: number;
      }>('/inventory/bulk-imports', { method: 'POST', body: form });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useResolveImportRow(batchId: string) {
  return useInventoryMutation(({ rowId, ...body }: ImportRowResolve & { rowId: string }) =>
    apiFetch<{ ok: true; status: string }>(
      `/inventory/bulk-imports/${batchId}/rows/${rowId}/resolve`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  );
}

export function useReprocessImport(batchId: string) {
  return useInventoryMutation(() =>
    apiFetch<{ queued: boolean }>(`/inventory/bulk-imports/${batchId}/reprocess`, {
      method: 'POST',
    }),
  );
}
