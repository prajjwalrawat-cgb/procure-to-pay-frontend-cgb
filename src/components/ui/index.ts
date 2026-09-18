// @/components/ui — design system. Tokens + shadcn base + ProcureFlow extensions.
export * from './lib/cn';
export * from './tokens';
export * from './chart-tokens';

// Primitives.
export * from './components/button';
export * from './components/input';
export * from './components/card';
export * from './components/badge';
export * from './components/pill';
export * from './components/dialog';
export * from './components/command';
export * from './components/tabs';
export * from './components/tooltip';
export * from './components/avatar';
export * from './components/table';

// Shell. The top nav replaced the navy sidebar + topbar in the redesign;
// sidebar.tsx / topbar.tsx are gone rather than left as a second, divergent
// way to build chrome.
export * from './components/top-nav';
export * from './components/command-palette';

// Shared patterns — loading/empty/error, page framing, honesty markers.
export * from './components/data-state';
export * from './components/page-header';
export * from './components/step-indicator';
export * from './components/sandbox-chip';

// Domain components.
export * from './components/approval-chain';
export * from './components/kpi-card';
export * from './components/ledger-strip';
export * from './components/metric-bar';
export * from './components/score-breakdown';
export * from './components/stage-strip';

export * from './components/coming-in-slice';
export * from './components/stubs';
