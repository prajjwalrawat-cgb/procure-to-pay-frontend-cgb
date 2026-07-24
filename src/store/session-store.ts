'use client';

import { create } from 'zustand';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  mfaEnabled: boolean;
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
