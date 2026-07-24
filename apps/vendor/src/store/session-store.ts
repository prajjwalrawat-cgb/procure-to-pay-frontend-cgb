'use client';

import { create } from 'zustand';

export interface VendorSessionUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

interface SessionState {
  accessToken: string | null;
  user: VendorSessionUser | null;
  setSession: (accessToken: string, user: VendorSessionUser) => void;
  clear: () => void;
}

// Access token in memory only; refresh token stays in an httpOnly cookie.
export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
}));
