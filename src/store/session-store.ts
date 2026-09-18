'use client';

import { create } from 'zustand';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  /** Effective permissions from the API — the role bundles plus whatever the
   *  tenant's active approval matrices grant those roles. Optional so a session
   *  restored from an older payload still renders; `useHasPermission` falls
   *  back to deriving from `roles` when it is absent. */
  perms?: string[];
  mfaEnabled: boolean;
  /** The signed-in user's own organisation, from /users/me or login. Screens
   *  that display the buying org's name read it from here — never a literal,
   *  so every tenant sees its own name. */
  tenant?: { id: string; name: string };
}

/**
 * Session state. The access token lives ONLY in memory (Master Context Slice 0:
 * never localStorage). The refresh token is an httpOnly cookie the browser
 * cannot read; it is exchanged for a fresh access token via a route handler.
 */
interface SessionState {
  accessToken: string | null;
  user: SessionUser | null;
  setSession: (accessToken: string, user: SessionUser) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
}));

/**
 * The signed-in organisation's name. Empty while the session is still
 * bootstrapping, so callers must render it as optional.
 *
 * This used to be appended to every page subheading as a dot-joined suffix via a
 * `tenantSuffix` helper. It is shown once now, in the account menu: a
 * single-tenant session does not need its own name repeated under ninety page
 * titles, and the middle-dot join made the subheading read as a fragment.
 */
export function useTenantName(): string {
  return useSessionStore((s) => s.user?.tenant?.name ?? '');
}
