'use client';

import { create } from 'zustand';

/**
 * UI-only state (Master Context §2 — Zustand for UI state, not server state).
 *
 * The rail-collapse and focus-mode flags went with the navy rail. The top nav
 * is 88px of chrome that does not need hiding, and "focus mode" existed to
 * reclaim the 240px the rail was taking from a table — a problem the new
 * layout does not have.
 */
interface UiState {
  trayOpen: boolean;
  commandOpen: boolean;
  setTrayOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  trayOpen: false,
  commandOpen: false,
  setTrayOpen: (trayOpen) => set({ trayOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}));
