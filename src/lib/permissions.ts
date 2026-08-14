'use client';

import { ROLE_PERMISSIONS, type Permission, type RoleName } from '@/lib/shared';
import { useSessionStore } from '@/store/session-store';

/**
 * Client-side permission check, derived from the session's roles exactly the way
 * the API derives the JWT's `perms` (auth.service issueTokens).
 *
 * Cosmetic only — it hides controls whose route would 403 anyway. The
 * `@RequirePermission` guard on the endpoint remains the real gate.
 */
export function useHasPermission(permission: Permission): boolean {
  const roles = useSessionStore((s) => s.user?.roles);
  return (roles ?? []).some((r) =>
    (ROLE_PERMISSIONS[r as RoleName] ?? []).includes(permission),
  );
}
