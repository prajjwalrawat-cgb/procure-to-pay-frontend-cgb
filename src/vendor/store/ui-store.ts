'use client';

import { create } from 'zustand';

/**
 * UI-only state for the vendor portal, mirroring the buyer shell's store.
 *
 * Kept separate from the buyer store because the two portals are independent
 * surfaces. Only the command palette lives here now: the rail-collapse state
 * went with the rail, and the vendor portal has no notifications API, so there
 * is no tray to open either.
 */
interface VendorUiState {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

export const useVendorUiStore = create<VendorUiState>((set) => ({
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}));
