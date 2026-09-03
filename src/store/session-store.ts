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
 * The signed-in organisation's name, for page subheadings. Empty while the
 * session is still bootstrapping, so callers render it as an optional suffix
 * rather than reserving space for a name that may not have arrived yet.
 */
export function useTenantName(): string {
  return useSessionStore((s) => s.user?.tenant?.name ?? '');
}

/** " · Acme Ltd" once the tenant is known, "" before that. */
export function tenantSuffix(name: string): string {
  return name ? ` · ${name}` : '';
}
