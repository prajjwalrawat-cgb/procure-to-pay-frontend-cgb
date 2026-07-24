'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AuditListResponse, AuditVerifyResult } from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';
import { API_URL } from '@/lib/env';

export interface AuditFilters {
  from?: string;
  to?: string;
  action?: string[];
  entityType?: string[];
  entityId?: string;
  search?: string;
}

function toQuery(f: AuditFilters): string {
  const params = new URLSearchParams();
  if (f.from) params.set('from', f.from);
  if (f.to) params.set('to', f.to);
  if (f.action?.length) params.set('action', f.action.join(','));
  if (f.entityType?.length) params.set('entityType', f.entityType.join(','));
  if (f.entityId) params.set('entityId', f.entityId);
  if (f.search) params.set('search', f.search);
  params.set('limit', '100');
  return params.toString();
}

export const auditKeys = {
  all: ['audit'] as const,
  list: (f: AuditFilters) => ['audit', 'list', f] as const,
};

export function useAuditLog(filters: AuditFilters): UseQueryResult<AuditListResponse> {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => apiFetch<AuditListResponse>(`/audit?${toQuery(filters)}`),
  });
}

export async function verifyChain(filters: AuditFilters): Promise<AuditVerifyResult> {
  return apiFetch<AuditVerifyResult>('/audit/verify', {
    method: 'POST',
    body: JSON.stringify({ from: filters.from, to: filters.to }),
  });
}

/** Direct download URLs (browser follows with the bearer token via a new tab is
 *  not possible, so callers fetch + blob). Exposed for the export buttons. */
export function exportUrl(kind: 'csv' | 'pdf', filters: AuditFilters): string {
  return `${API_URL}/audit/export/${kind}?${toQuery(filters)}`;
}
