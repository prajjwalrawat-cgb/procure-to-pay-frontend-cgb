'use client';

import { create } from 'zustand';

/** UI-only state (Master Context §2 — Zustand for UI state, not server state). */
interface UiState {
  sidebarCollapsed: boolean;
  focusMode: boolean;
  trayOpen: boolean;
  commandOpen: boolean;
  toggleSidebar: () => void;
  toggleFocus: () => void;
  setTrayOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  focusMode: false,
  trayOpen: false,
  commandOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleFocus: () => set((s) => ({ focusMode: !s.focusMode })),
  setTrayOpen: (trayOpen) => set({ trayOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}));
