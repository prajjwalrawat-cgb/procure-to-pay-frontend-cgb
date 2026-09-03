'use client';

import { ROLE_PERMISSIONS, type Permission, type RoleName } from '@/lib/shared';
import { useSessionStore } from '@/store/session-store';

/**
 * Client-side permission check.
 *
 * Reads the session's `perms` — the effective set the API resolved when it
 * issued the token. That matters because not all authority comes from the role
 * bundle any more: a role the tenant's approval matrix names as an approver
 * picks up the permissions that decision depends on (document verification,
 * bank override), and deriving from `roles` alone would hide controls the API
 * would happily accept. Falls back to the role table for a session payload that
 * predates `perms`.
 *
 * Cosmetic only — it hides controls whose route would 403 anyway. The
 * `@RequirePermission` guard on the endpoint remains the real gate.
 */
export function useHasPermission(permission: Permission): boolean {
  const user = useSessionStore((s) => s.user);
  if (user?.perms) return user.perms.includes(permission);
  return (user?.roles ?? []).some((r) =>
    (ROLE_PERMISSIONS[r as RoleName] ?? []).includes(permission),
  );
}
