'use client';

import { create } from 'zustand';

/**
 * UI-only state for the vendor portal, mirroring the buyer shell's store.
 *
 * The vendor portal previously had no such store, so its shell could not offer
 * the rail-collapse control or the command palette — the two things a supplier
 * working in a narrow window needs most. Kept separate from the buyer store
 * because the two portals are independent surfaces and should not share
 * collapse state.
 *
 * Focus mode and the notifications tray are deliberately absent: the vendor
 * portal has no notifications API, so there is nothing to open.
 */
interface VendorUiState {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
}

export const useVendorUiStore = create<VendorUiState>((set) => ({
  sidebarCollapsed: false,
  commandOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}));
