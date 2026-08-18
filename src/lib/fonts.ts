// Three faces, three jobs (see components/ui/tokens.ts → typography):
//   display — Source Serif 4, module headers + KPI values, >=18px only.
//   sans    — Geist Sans, body and dense table rows.
//   mono    — Geist Mono, money / dates / IDs / hashes with tabular figures.
//
// Geist ships self-hosted via the official `geist` package, which exposes the
// `--font-geist-sans` / `--font-geist-mono` variables the tokens rely on.
// (`next/font/google` does not carry Geist in this Next version.)
import { Source_Serif_4 } from 'next/font/google';

export { GeistSans as geistSans } from 'geist/font/sans';
export { GeistMono as geistMono } from 'geist/font/mono';

/**
 * The display face. A serif is the deliberate call here: it carries the
 * institutional register the product needs (payment runs, statutory
 * compliance) and it is the one part of this palette that no generic SaaS
 * dashboard uses. `display: 'swap'` keeps first paint on the fallback serif
 * rather than blocking, and the fallback stack is a real serif so a failed
 * fetch degrades in register rather than snapping to sans.
 */
export const displaySerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-display',
  fallback: ['ui-serif', 'Georgia', 'serif'],
});
