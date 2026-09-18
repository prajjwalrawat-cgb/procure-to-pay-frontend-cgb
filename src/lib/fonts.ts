// One UI face, one utility face (see components/ui/tokens.ts → typography):
//   ui   — Inter. Everything: nav, headings, dense tables, ₹ columns. Inter's
//          tabular figures are what the `.font-numeric` helper switches on, so
//          amounts align without swapping to a second family mid-row.
//   mono — Geist Mono. Hash chains and machine identifiers in the audit log,
//          where character-level distinction is the actual requirement.
//
// The display serif that used to sit above every page header is gone. A serif
// heading over a 13px data grid reads as two products stapled together; the
// heading register is now a size and weight step within Inter.
import { Inter } from 'next/font/google';

export { GeistMono as geistMono } from 'geist/font/mono';

export const interUi = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ui',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});
