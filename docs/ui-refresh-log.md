# ProcureFlow design system — "Clear Ledger"

Living document. This describes the system as it stands after the 2026 redesign,
which replaced the previous "Midnight Executive" direction (navy chrome / gold
consequence / ice surfaces) with a light, single-accent system modelled on
Coupa's sourcing UI.

The old direction is not documented here beyond the migration notes: it is gone
from the codebase, and a design doc describing two systems is a doc nobody
trusts. Its reasoning is in git history.

---

## 1. Why the direction changed

The previous system carried five colours that competed for meaning: navy chrome,
gold for "consequence", violet for classification, blue for "in flight", and
emerald as the interactive accent. Two consequences:

- **Colour stopped meaning anything.** A list of forty invoices rendered in five
  hues, none of which the reader could decode without a legend. Filled status
  pills on every row competed with the navigation, which was also pill-shaped.
- **Chrome differed per screen.** Ninety pages each brought their own centred
  container at one of nine widths, their own tab-row class string, their own
  `inputCls`, their own table header treatment. Moving between two screens felt
  like moving between two applications.

The redesign fixes both at the system layer rather than screen by screen.

---

## 2. Tokens

Source of truth: [`src/components/ui/tokens.ts`](../src/components/ui/tokens.ts).
Mirrored as CSS variables in
[`src/components/ui/styles.css`](../src/components/ui/styles.css) and as Tailwind
utilities via [`tailwind-preset.ts`](../src/components/ui/tailwind-preset.ts).

### One accent

`--accent` (`#1B4CE0`) is the only non-semantic colour in the system, and it
means **interactive or active**: the current nav pill, a primary button, a
focused input, a link, the current wizard step. Nothing else.

### Semantic state — status only, never decoration

| Role | Text value | Fill value | Background |
|---|---|---|---|
| success | `#147A52` | `#1E9E6B` | `#E9F7EF` |
| warn | `#8A5E0E` | `#B07A12` | `#FBF2E2` |
| danger | `#B23A31` | `#C4453B` | `#FBEAE8` |

Two values per state because one cannot serve both jobs: the brief's `#1E9E6B`,
`#B07A12` and `#C4453B` are 2.9:1, 3.4:1 and 4.2:1 as text on white and cannot
carry a status label. The `-solid` values are used for dots, bars and fills,
where contrast is not a text obligation. Same reasoning darkened `--text-faint`
one step from the brief's `#8A8F98` (3.15:1) to `#767C85` (4.52:1).

### Legacy names, remapped

Ninety screens referenced `gold`, `violet`, `info` and `navy`. Rather than
rewrite every className, those names survive and now resolve to the accent (or,
for `navy`, to white chrome with dark text). That is what let the redesign land
everywhere at once. **New work should use `accent`, `success`, `warn`, `danger`
and nothing else.**

### Type

One face: **Inter**, at three sizes — 12px meta, 13px body, 19px heading. The
display serif is gone; a serif header above a 13px data grid read as two
products stapled together. `.font-display` survives as a weight/tracking step
within Inter so page headers did not all need rewriting. `font-mono` (Geist
Mono) is kept for one job: hash chains in the audit log.

`.font-numeric` switches on tabular figures. Every `<table>` in the app gets
them for free via a base rule, so a numeric column cannot silently misalign
because someone forgot the class.

---

## 3. Components

Build screens out of these. **No screen-specific CSS for chrome.**

| Component | File | Rule |
|---|---|---|
| `TopNav` | `components/top-nav.tsx` | Two rows: identity + global search, then section tabs. Active tab is a filled accent pill. |
| `SubNav` | `components/top-nav.tsx` | Per-screen tab row. Accent text + 2px accent underline, **no fill** — deliberately lighter than the nav pill so the two levels are never confused. |
| `Card` / `CardGrid` | `components/card.tsx` | Comparison views only (vendors, sourcing, contracts, kanban). Hairline border, no shadow. Header takes **one** badge; footer takes one metadata string and one action. |
| `Table` | `components/table.tsx` | Transactional lists (POs, invoices, receipts, inventory). No card wrapper — hairline row dividers only. Sentence-case heads. `numeric` prop right-aligns and switches to tabular figures. |
| `StatusText` (alias `Pill`) | `components/pill.tsx` | Status as **coloured text with a dot**, never a filled pill. |
| `Badge` | `components/badge.tsx` | Trust/classification only (MSME, Verified, risk grade). Two variants: `classification` (accent tint) or a semantic state. There is no way to add a seventh hue. |
| `Button` | `components/button.tsx` | `primary` (filled accent) — **one per screen or per card**. Everything else `secondary`. `danger` is the confirm step of a destructive action only. |
| `Input` / `Select` / `DateInput` / `Textarea` / `Combobox` / `Field` | `components/input.tsx` | One control definition, exported as `controlClass` for screens that still style raw elements inline. **Above ~10 options use `Combobox`**, not a native `<select>`. |
| `StepIndicator` | `components/step-indicator.tsx` | Wizard steps. Accent for current, tick for done, faint for future, a rule (not a dot) as the connector. |
| `EmptyState` / `DataState` / `TableState` | `components/data-state.tsx` | No floating icon. One line explaining what will appear here and why it is empty, plus one action. Error stays distinct from empty. |
| `SandboxChip` / `VerificationResult` | `components/sandbox-chip.tsx` | A simulated provider result reads "Awaiting <check>" in muted text and loses its semantic colour. Never "SANDBOX". |

### Layout

The shell owns the outer container: one centred `max-w-[1400px]` in
`app-shell.tsx` / `vendor-shell.tsx`. Pages that want a narrow measure (forms,
wizards) cap their own width but **do not** re-centre — so every screen starts
at the same left edge.

---

## 4. Anti-patterns — do not reintroduce

- ALL-CAPS labels anywhere. Sentence case only; `tracking-wide` goes with them.
- Middle-dot-joined meta strings (`Purchase requests · Acme Ltd`). Use a
  breadcrumb, or drop the redundant context.
- A colour per category. Every badge is neutral classification or semantic state.
- Native unstyled `<select>` / `<input type="date">`, or a fresh `inputCls`.
- Raw enums in front of a user (`EXPIRING_SOON`, `NOT_CHECKED`, `SPOT_BUY`).
  `statusLabel()` and `humanise()` in `lib/format.ts` exist for this.
- Dev/test state labels (`SANDBOX`) on user-facing screens.
- Dead progress bars, or a `0%` / `N/A` with no explanation. Say why in words.
- More than one filled button visible at once.
- `toLocaleDateString`. One format, `dd/mm/yyyy`, via `formatDate()`.
- Raw Tailwind palette classes (`text-red-600`, `border-gray-300`). Use tokens.

---

## 5. Acceptance checklist

Before calling a screen done:

- [ ] Uses only the shared nav, card, table, status, badge and button components.
- [ ] All ₹ and quantity columns are right-aligned with tabular figures.
- [ ] All dates go through `formatDate` / `formatDateTime`.
- [ ] Only `--accent` appears outside the semantic state colours.
- [ ] No ALL-CAPS labels, no middle-dot strings, no raw enums, no dev-state labels.
- [ ] Every empty state has an explanation and one action.
- [ ] Every badge is neutral classification or semantic state.
- [ ] At most one primary button visible.
