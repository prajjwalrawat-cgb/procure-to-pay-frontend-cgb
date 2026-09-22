'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { PERMISSIONS } from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';
import { teamKeys, type TeamMember } from '@/lib/api/users';
import { useHasPermission } from '@/lib/permissions';
import { useSessionStore } from '@/store/session-store';

/**
 * Resolves a requisition's requester to a name a person can read.
 *
 * The board and list payloads fill `requester.name` with the requester's *id*
 * (requisition-query.service.ts, toCard) — a backend bug. Printing it would
 * put "usr_01KYM9…" on every card, so a name that equals the id is treated as
 * missing and resolved from, in order:
 *   1. the signed-in user ("You"),
 *   2. the team list, when the viewer may read users (same query as /team),
 *   3. nothing — the caller hides the field rather than show an id.
 */
export function useRequesterName(): (r: { id: string; name: string }) => string | null {
  const me = useSessionStore((s) => s.user?.id);
  const canReadUsers = useHasPermission(PERMISSIONS.USER_READ);
  const team = useQuery({
    queryKey: teamKeys.list(),
    queryFn: () => apiFetch<TeamMember[]>('/users'),
    enabled: canReadUsers,
    staleTime: 5 * 60_000,
  });
  const byId = useMemo(
    () => new Map((team.data ?? []).map((m) => [m.id, m.name])),
    [team.data],
  );
  return useCallback(
    (r) => {
      if (r.id === me) return 'You';
      if (r.name && r.name !== r.id) return r.name;
      return byId.get(r.id) ?? null;
    },
    [me, byId],
  );
}
