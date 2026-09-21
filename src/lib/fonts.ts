// One UI face, one utility face (see components/ui/tokens.ts → typography):
//   ui   — Geist Sans. Everything: nav, headings, dense tables, ₹ columns. Its
//          tabular figures are what the `.font-numeric` helper switches on, so
//          amounts align without swapping to a second family mid-row.
//   mono — Geist Mono. Hash chains and machine identifiers in the audit log,
//          where character-level distinction is the actual requirement.
import { GeistSans } from 'geist/font/sans';

export { GeistMono as geistMono } from 'geist/font/mono';

/** Exposes `--font-geist-sans`; styles.css maps `--font-ui` onto it. */
export const geistUi = GeistSans;
