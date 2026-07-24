/**
 * WCAG 2.1 AA contrast gate for the ProcureFlow design tokens (Slice 11b).
 *
 * Computes the real contrast ratio for every text/background token pair the UI
 * actually renders and fails (exit 1) if any normal-size text pair drops below
 * 4.5:1. This is the executable half of the accessibility review — it needs no
 * browser, so it runs in CI as a regression guard on `packages/ui/src/tokens.ts`
 * (the single source of truth). The axe-core end-to-end pass (e2e/a11y.spec.ts)
 * covers live-DOM concerns this static check cannot (focus order, ARIA, etc.).
 *
 * Run: pnpm --filter @procureflow/ui contrast:check
 */
import { colors } from '../src/tokens';

type Hex = string;

const srgb = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (hex: Hex): number => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};

const ratio = (a: Hex, b: Hex): number => {
  const [l1, l2] = [luminance(a), luminance(b)];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

const AA_NORMAL = 4.5;

/**
 * Every foreground/background token combination the buyer + vendor portals
 * render as normal-size text (including white button labels on solid fills).
 * Large-text-only (≥18.66px bold / ≥24px) and purely decorative pairs would use
 * the 3.0 threshold — none are relied on below, so all rows are held to 4.5.
 */
const PAIRS: Array<{ fg: keyof typeof colors; bg: keyof typeof colors; use: string }> = [
  { fg: 'text', bg: 'panel', use: 'primary text on card' },
  { fg: 'text', bg: 'paper', use: 'primary text on page' },
  { fg: 'text', bg: 'canvas', use: 'primary text on canvas' },
  { fg: 'muted', bg: 'panel', use: 'secondary text on card' },
  { fg: 'muted', bg: 'paper', use: 'secondary text on page' },
  { fg: 'muted', bg: 'canvas', use: 'secondary text on canvas' },
  { fg: 'faint', bg: 'panel', use: 'micro-label on card' },
  { fg: 'faint', bg: 'paper', use: 'micro-label on page' },
  { fg: 'faint', bg: 'canvas', use: 'micro-label on canvas' },
  { fg: 'accent', bg: 'panel', use: 'accent link/number on card' },
  { fg: 'accent', bg: 'accent-wash', use: 'accent text on success chip' },
  { fg: 'accent-2', bg: 'panel', use: 'accent-hover text' },
  { fg: 'danger', bg: 'panel', use: 'error text on card' },
  { fg: 'danger', bg: 'danger-wash', use: 'error text on chip' },
  { fg: 'warn', bg: 'panel', use: 'warning text on card' },
  { fg: 'warn', bg: 'warn-wash', use: 'warning text on chip' },
  { fg: 'info', bg: 'panel', use: 'info text on card' },
  { fg: 'info', bg: 'info-wash', use: 'info text on chip' },
  { fg: 'violet', bg: 'panel', use: 'violet text on card' },
  { fg: 'violet', bg: 'violet-wash', use: 'violet text on chip' },
  // White labels on solid button fills (contrast is symmetric with fg/bg text).
  { fg: 'panel', bg: 'ink', use: 'white label on primary button' },
  { fg: 'panel', bg: 'accent', use: 'white label on accent button' },
  { fg: 'panel', bg: 'accent-2', use: 'white label on accent-hover' },
  { fg: 'panel', bg: 'danger', use: 'white label on danger button' },
];

let failures = 0;
console.log('WCAG 2.1 AA contrast gate — normal text ≥ 4.5:1\n');
for (const { fg, bg, use } of PAIRS) {
  const r = ratio(colors[fg], colors[bg]);
  const ok = r >= AA_NORMAL;
  if (!ok) failures += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${String(fg).padEnd(9)} on ${String(bg).padEnd(12)} ` +
      `${r.toFixed(2).padStart(5)}:1  ${use}`,
  );
}

console.log(
  `\n${failures === 0 ? '✅ all pairs pass AA' : `❌ ${failures} pair(s) below 4.5:1`}`,
);
process.exit(failures === 0 ? 0 : 1);
