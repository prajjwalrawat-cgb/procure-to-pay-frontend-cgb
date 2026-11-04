'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { toApiError } from '@/lib/api-error';

/** An organisation (tenant) the signed-in person belongs to. */
export interface Workspace {
  tenantId: string;
  name: string;
  current: boolean;
}

export const workspaceKeys = {
  all: ['workspaces'] as const,
};

export function useWorkspaces(): UseQueryResult<Workspace[]> {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: () => apiFetch<Workspace[]>('/workspaces'),
    staleTime: 5 * 60_000,
  });
}

/** Create a new organisation; the caller becomes its admin. */
export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Workspace>('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

/**
 * Move the session into another organisation, then hard-reload so no cached
 * query from the previous organisation survives into the next one.
 */
export async function switchWorkspace(tenantId: string): Promise<void> {
  const res = await fetch('/api/auth/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId }),
  });
  if (!res.ok) throw await toApiError(res, 'Could not switch organisation');
  window.location.assign('/');
}
