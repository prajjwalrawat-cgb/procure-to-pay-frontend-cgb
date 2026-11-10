// The AskMira type pairing (see components/ui/tokens.ts → typography):
//   ui      — Inter. Everything: nav, dense tables, ₹ columns. Its tabular
//             figures are what the `.font-numeric` helper switches on.
//   display — Fraunces. Page titles only, as in AskMira.
//   mono    — Geist Mono. Hash chains and machine identifiers in the audit log.
import { Fraunces, Inter } from 'next/font/google';

export { GeistMono as geistMono } from 'geist/font/mono';

/** Exposes `--font-inter`; styles.css maps `--font-ui` onto it. */
export const geistUi = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

/** Exposes `--font-fraunces`; styles.css maps `--font-display` onto it. */
export const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'opsz'],
});
