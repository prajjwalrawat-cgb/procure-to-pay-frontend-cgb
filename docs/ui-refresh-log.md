# ProcureFlow UI refresh — design system & conversion log

Living document. Update the table at the bottom as pages are converted so the
work can be picked up cleanly across sessions.

---

## 1. The design system

### Direction: Midnight Executive — navy / gold / ice

**One deliberate deviation from the brief, stated up front.** The brief asks for
navy/gold/ice and could be read as "make the app dark". It is not built that
way, and the reasoning matters:

- This app lives in dense financial tables at a 13.5px base size, with long
  columns of ₹ amounts. Those are materially harder to scan on a dark ground.
- The existing palette carried deliberate WCAG 2.1 AA work (there are contrast
  ratios annotated in the old `tokens.ts`). Inverting to a dark surface would
  have thrown all of it away and required re-deriving every semantic colour.

So the three registers are split by **role**, not by mode:

| Register | Where it lives | Why |
|---|---|---|
| **Navy** | Chrome — sidebar, topbar, table header seams | The institutional frame *around* the data, never the data surface |
| **Ice** | Page canvas, panels, wells | Cool near-whites so the navy reads as a deliberate frame, not an accident |
| **Gold** | Consequence only | Approve, award, issue, release a payment run |

A true dark mode is now a token swap rather than a rewrite: every colour is a
CSS variable in `src/components/ui/styles.css`, derived from
`src/components/ui/tokens.ts`.

### Colour tokens

Source of truth: [`src/components/ui/tokens.ts`](../src/components/ui/tokens.ts).
Every foreground value was recomputed against the surface it actually sits on
and meets AA (4.5:1) as body text.

| Token | Hex | Contrast |
|---|---|---|
| `paper` / `canvas` / `panel` | `#F4F7FB` / `#E9EFF7` / `#FFFFFF` | surfaces |
| `navy` / `navy-2` / `navy-3` | `#0A1424` / `#142338` / `#1C2F49` | chrome |
| `on-navy` / `on-navy-muted` | `#E6EDF7` / `#9FB0C8` | 8.4:1 / 8.38:1 on navy |
| `ink` / `text` | `#0A1424` / `#1F2C40` | primary / body |
| `muted` / `faint` | `#55647C` / `#5D6B80` | 5.19:1 / 4.73:1 on canvas |
| `gold` | `#C89B2C` | 7.20:1 **on navy** |
| `gold-ink` | `#8A6A12` | 5.09:1 on panel — gold *as text* |
| `accent` (emerald) | `#0F7A52` | 5.34:1 |
| `danger` / `warn` / `info` | `#C2183F` / `#9A5B02` / `#1D5FA8` | 5.99 / 5.35 / 6.38:1 |

**Two golds, not one.** A gold bright enough to read on navy (7.2:1) is ~1.9:1
on white and illegible as text. `gold` is for on-navy fills and seams;
`gold-ink` is for gold-as-text on light surfaces.

### Type — three faces, three jobs

- **Display** — Source Serif 4, **≥18px only**, via the `.font-display` class.
  Used in exactly two places: `PageHeader` and `KpiCard`. A serif at table sizes
  reads dated, so the gate is structural rather than a convention.
- **Body** — Geist Sans, 13.5px base, for dense table rows.
- **Mono** — Geist Mono with `font-variant-numeric: tabular-nums`, via
  `.font-numeric`, for money, dates, IDs and hashes so ₹ columns align.

Numeric alignment is now structural too: `<TableHead numeric>` / `<TableCell
numeric>` right-align and switch to tabular figures, so passing the prop is the
easy path and hand-rolling the classes is the hard one.

### Layout concept — "the ledger frame"

- **Navy rail** — collapsible to an icon rail; off-canvas drawer below `lg`.
  Active item marked with a gold seam.
- **Ice work surface** — white panels on an ice canvas.
- **Document detail pages** share one three-zone frame: `PageHeader` →
  `StageStrip` → content, with a **ledger rail** on the right that always ends
  in the audit ledger. Same position on every document.
- **List pages**: `PageHeader` → filters → table with the three shared states.

### Signature element — the Ledger Strip

Every action is written to a tamper-evident hash chain, and that was buried
behind an audit tab nobody opens. `LedgerStrip` renders it as a physical chain
of links on every document detail page, with a live **Verify** action that calls
the real `/audit/verify` cryptographic pass.

**The constraint that shaped it:** the hash chain is *global*, not per-document.
Record N links to record N-1 in the whole tenant log, not to the previous event
on this invoice. A client-side link check over a document-filtered list would
therefore report false breaks. So the component **never computes integrity
itself** — it renders the document's events and takes the verdict from the
server. Until a verification has been run it says "Not yet verified" rather than
showing a reassuring green. An unverified chain must never look verified.

### Self-critique pass

What the critique changed, honestly recorded:

1. **"Navy rail + light content + one accent" is the most common enterprise SaaS
   layout there is.** Largely true, and the layout skeleton is deliberately
   familiar — novelty in enterprise navigation is a liability. What is *not*
   generic has to carry the identity: the gold discipline, the ledger rail as a
   fixed trust column, and a serif display face that almost no SaaS dashboard
   uses.
2. **Gold discipline is easy to state and impossible to police across 86 pages.**
   → Changed the API: the gold button variant is named `commit`, not `gold`.
   `variant="commit"` on a filter dropdown reads wrong at the call site where
   `variant="gold"` would not. There is deliberately no gold escape hatch.
3. **The Ledger Strip risks being blockchain-flavoured ornament.**
   → It must be functional or it is decoration: links are clickable and reveal
   the real hash pair, Verify hits the real endpoint, and an empty history says
   so instead of drawing a fake chain.
4. **A serif could look dated in a dense app.** → Gated to ≥18px, two components.
5. **Was the AA work being regressed?** → Every token recomputed and annotated;
   the muted/faint hierarchy is preserved under the 4.5:1 floor.

---

## 2. UI honesty fixes

These were treated as functional bugs, not polish.

### Sandbox marking

`<SandboxChip>`, `<VerificationResult>` and `<SandboxBanner>` in
[`sandbox-chip.tsx`](../src/components/ui/components/sandbox-chip.tsx). Two rules
are encoded in the components rather than left to reviewers:

1. A simulated result always carries a visible chip.
2. **A simulated result never keeps its semantic colour.** A green pill beside a
   small grey chip still reads as "pass" at a glance, so `VerificationResult`
   downgrades the pill to neutral *and* adds the chip.

### The dangerous one: configured ≠ live

The obvious inference — "credential configured means real provider" — is wrong
in the dangerous direction, and the seeded tenant proves it: **GSP shows
`configured` with the label "Star Cement GSP (sandbox)" while every recorded GSP
call comes back simulated.** The first version of this work trusted `configured`
and rendered a green `MATCHED` for a mock GSTR-2B reconciliation — exactly the
bug the brief asked to eliminate.

[`src/lib/integration-status.ts`](../src/lib/integration-status.ts) now infers
liveness *behaviourally* from `/integrations/usage`: a provider is live only if
it has recorded calls this month **and** not all of them were simulated.
`configured && isActive` is a necessary precondition, not a sufficient one. It
**fails closed** — loading, unknown provider, or zero calls all report sandbox.

### Pre-Phase-2 honesty sweep

Run across all remaining pages before starting Phase 2, rather than folding it
into the styling work — the sanctions violation was only found by looking for
it, so the rest of the app was searched the same way instead of assumed clean.

Found and fixed:

- **`AUTO VERIFIED` document pills rendered green** on vendor onboarding.
  Documents are auto-verified against the PAN and GSTN registries; when those
  answer from a sandbox the badge is unearned. Now chipped via
  `VerificationResult`. `MANUALLY_VERIFIED` was a human and keeps its colour.
- **"Assign" and "Hold" on the invoices bulk bar reported success and did
  nothing** — `onClick={() => toast('Held', 'success')}`. A false success is
  worse than a dead button: a user who selected five invoices and saw "Held"
  would reasonably believe those invoices were on hold. Both disabled and
  marked `NotShipped`.

Checked and found clean:

- No other controls whose only behaviour is a toast.
- `/vendor/documents` and `/vendor/profile` already use the honest
  `ComingInSlice` placeholder.
- Vendor 360 shows a computed risk grade/score, not a provider verdict badge —
  a different category from a "CLEAR"/"ACTIVE" claim, so left as is.

### Unshipped controls

`<NotShipped>` renders a visible **SOON** chip beside a disabled control and
keeps the explanation reachable by assistive tech.

- PO **Amend** was `<span title="Coming in Slice 5.5">` — hover-only, invisible
  on touch and to keyboard users.
- Invoices **Import** / **New invoice** were live-looking buttons whose only
  behaviour was a "coming soon" toast.

### Other bugs found and fixed en route

| Bug | Where | Fix |
|---|---|---|
| Missing React `key` on a fragment wrapping each row pair | invoices list | `<Fragment key={inv.id}>` |
| `aria-pressed` on `role="listitem"` (invalid) | LedgerStrip | group of toggle buttons |
| Failed fetch rendered as an empty table — "you have no invoices" vs "we couldn't load them" | every list | `TableState` treats `error` as a first-class branch |
| Stage labels collapsed into unreadable mush on mobile | StageStrip | scrolls instead of squeezing |
| Detail pages scrolled horizontally on mobile | 4 detail pages | `grid-cols-1` (`minmax(0,1fr)`) + tables scroll in their own container |
| `STANDARD` priority painted a loud blue badge on every row and card | `refs.ts` + board | default reads quiet; only exceptions get colour |
| **Every detail page showed no active nav item** — exact-match `activeHref` meant `/invoices/inv_4408` lit nothing in an 18-module rail | Sidebar | `isActiveHref()`: a section owns its subtree; `/` stays exact |
| A `<button>` with no `onClick` in every PO row | PO list | dead control removed |
| `SUBMITTED_PENDING_BANK_CONFIRMATION` rendered raw in a status pill | `format.ts` | added the missing payment-run labels + variants |
| Empty `<ul>` under a heading read as a broken panel | GRN detail activity | shared `EmptyState` |
| 404 copy said "this record may have been deleted" on collection endpoints | `DataState` | reworded for both cases, made retryable |

---

## 3. API gaps (flagged, not worked around in the backend)

| Gap | Impact | Suggested fix |
|---|---|---|
| **`GET /invoices/:id` is registered before `GET /invoices/inbound-emails`** | 🔴 **Live bug.** Express matches `:id = "inbound-emails"`, the invoices controller throws "not found", and the endpoint 404s. The intake page's *Pending vendor match* and *Dead letter* queues have therefore **never worked** — the old lying empty state ("No emails awaiting vendor attribution") hid it completely. Now visible as an error state. | Register `IntakeController` before `InvoicesController`, or move the literal route above the `:id` route |
| `invoice.compliance` has no `simulated` flag — `gstinStatus` / `gstr2bStatus` are bare strings with no provenance | Provenance is *inferred* client-side from usage data. It is an inference, not ground truth. | Add `simulated: boolean` per compliance field, as `Gstr2bReconResult` and `IrnValidationResult` already have |
| `CredentialStatusItem` cannot distinguish a sandbox key from a live one | Drove the false-green bug above | Add `isSandbox: boolean` |
| `VendorScreeningView` has no `simulated` flag | Sanctions/GSTIN/PAN verdicts infer provenance from `provider` + usage data | Add `simulated: boolean` |
| **`GET /rfq/:id/comparison` 500s: `TypeError: criteria.map is not a function`** | 🔴 **Live bug.** `quote-evaluation.service.ts:157` expects `evaluation_criteria` to be an array. Seeded RFQ-9001 / RFQ-8001 store it as an object (`{"price": 100}`), so evaluation and award are unreachable for them. RFQ-2026-0001 has the correct array shape and works. | Migrate the legacy object shape, or accept both in the service |
| **Upstash Redis request quota exhausted** | ⚠️ Infra. `max requests limit exceeded. Limit: 500000, Usage: 500005` — the `ocr` and `inventory-import` workers are erroring on every tick. Background jobs are silently dead. | Raise the Upstash plan or point local dev at a local Redis |
| Audit `entityType` is the PascalCase Prisma model name | A mismatched filter silently returns an empty ledger — the failure mode that makes the component lie. `DocumentLedger` filters by `entityId` alone to avoid it. | Document the enum, or accept a domain alias |

The route-shadowing bug is the only one that is a live defect rather than a
missing field. It was found because the shared error state stopped a failed
fetch from masquerading as an empty result — which is the whole argument for
treating `error` as a first-class branch.

---

## 4. Shared components added

| Component | File | Purpose |
|---|---|---|
| `DataState`, `TableState`, `EmptyState`, `ErrorState`, `Skeleton` | `ui/components/data-state.tsx` | The three states, block and table-row shapes |
| `PageHeader` | `ui/components/page-header.tsx` | Title, breadcrumbs, meta, actions |
| `SandboxChip`, `VerificationResult`, `SandboxBanner` | `ui/components/sandbox-chip.tsx` | Honesty markers |
| `NotShipped` | `ui/components/coming-in-slice.tsx` | Unshipped control marker |
| `LedgerStrip` | `ui/components/ledger-strip.tsx` | **Signature element** |
| `DocumentLedger` | `components/document-ledger.tsx` | LedgerStrip wired to the audit API |
| `ApprovalChain` | `ui/components/approval-chain.tsx` | Real routing topology (was a stub) |
| `KpiCard` | `ui/components/kpi-card.tsx` | Real KPI tile (was a stub) |
| `StageStrip` | `ui/components/stage-strip.tsx` | Real lifecycle track (was a stub) |
| `InfoTip` | `ui/components/tooltip.tsx` | Bundles the Radix compound API |

`KpiCard`, `StageStrip` and `ApprovalChainStep` were **typed stubs** with TODO
comments and no call sites — the components the signature work needed most.

Cross-cutting, in `styles.css`: one global `:focus-visible` outline (gold on
navy chrome), a skip link, and a global `prefers-reduced-motion` block so new
work cannot reintroduce unguarded animation.

---

## 5. Conversion log

**Legend** — Resp: responsive verified at 390px · States: uses shared
loading/empty/error · Ledger: has the audit ledger rail

### Phase 1 — core transactional spine

| Page | Resp | States | Ledger | Notes |
|---|---|---|---|---|
| `/requisitions` | ✓ | ✓ | n/a | PageHeader, board skeletons, `TableState` per tab |
| `/requisitions/[id]` | ✓ | — | ✓ | StageStrip, ApprovalChain, Approve + Create PO → `commit` |
| `/purchase-orders/[id]` | ✓ | — | ✓ | StageStrip, ApprovalChain, **Amend** marked, Approve + Issue → `commit` |
| `/invoices` | ✓ | ✓ | n/a | Import + New invoice marked; fragment-key bug fixed |
| `/invoices/[id]` | ✓ | — | ✓ | GSTIN / GSTR-2B / IRN via `VerificationResult` |
| `/payment-runs/[id]` | ✓ | — | ✓ | ApprovalChain w/ composer + bank bookends, Approve → `commit`, bank recon chip |
| `/inbox` | ✓ | ✓ | n/a | `TableState`, bulk approve → `commit` |
| `/goods-receipt` | ✓ | ✓ | n/a | PageHeader + `TableState` on both tables |
| `/integrations` | ✓ | — | n/a | False-green fix, `SandboxBanner`, per-row chips |
| `/purchase-orders` | ✓ | ✓ | n/a | PageHeader, `TableState`, dead "More" control removed |
| `/payment-runs` | ✓ | ✓ | n/a | PageHeader, `TableState`, status labels fixed |
| `/goods-receipt/[id]` | ✓ | ✓ | ✓ | StageStrip, ledger rail, activity empty state, table scrolls |
| `/goods-receipt/[id]/qc` | ✓ | — | n/a | PageHeader; 3-up parameter grids stack on mobile |
| `/invoices/intake` | ✓ | ✓ | n/a | OCR `SandboxBanner`; `DataState` on all three queues — **surfaced the route-shadowing 404** |
| `/vendors/onboarding/[id]` | ✓ | — | n/a | **Sanctions CLEAR violation fixed**; `SandboxBanner` for derived risk lights |
| `/requisitions/new` | ✓ | — | n/a | PageHeader (grids already had `md:` breakpoints) |
| `/purchase-orders/new` | ✓ | — | n/a | PageHeader |
| `/payment-runs/new` | ✓ | — | n/a | PageHeader |

**Phase 1 is complete.** The core transactional spine — requisition → PO → GRN →
invoice → 3-way match → approval → payment run — is converted end to end, plus
the intake and vendor-onboarding screens the honesty requirements reached into.

`States: —` on detail pages means the page has a single top-level record fetch
rather than a list; those still use the page-level loading guard. Converting
those to `DataState` is worthwhile but is not a list-view gap.

### Phase 2 — sourcing & vendor

All 13 pages converted. They started with **zero** responsive coverage and zero
shared states between them.

| Page | Resp | States | Notes |
|---|---|---|---|
| `/sourcing` | ✓ | ✓ | Fixed a `Date.now()`-in-render hydration mismatch in the deadline countdown |
| `/sourcing/new` | ✓ | ✓ | PageHeader; 2-up and 6-up wizard grids now stack |
| `/sourcing/[id]` | ✓ | ✓ | PageHeader, `StageStrip`, DataState |
| `/sourcing/[id]/publish` | ✓ | ✓ | PageHeader + breadcrumbs |
| `/sourcing/[id]/open` | ✓ | ✓ | PageHeader + breadcrumbs |
| `/sourcing/[id]/evaluate` | ✓ | ✓ | **`ScoreBreakdown`** on every row; empty state for an unquoted RFQ |
| `/sourcing/[id]/award` | ✓ | ✓ | Rebuilt — see below |
| `/sourcing/[id]/reverse-auction` | ✓ | ✓ | Stale-ladder warning when the SSE stream is offline |
| `/vendors` | ✓ | ✓ | PageHeader, DataState (403 stays distinct from empty) |
| `/vendors/[id]` | ✓ | ✓ | **Scorecard rebuilt** — see below |
| `/vendors/[id]/suspend` | ✓ | ✓ | PageHeader |
| `/vendors/onboarding` | ✓ | ✓ | PageHeader, DataState |
| `/vendors/onboarding/[id]` | ✓ | ✓ | PageHeader + breadcrumbs |

**Making the scoring maths visible** (the brief's named differentiator).
`ScoreBreakdown` decomposes a quote's weighted total into `raw × weight =
points` per criterion, with a bar scaled to 100 possible points. Every figure
comes from the API's `weightedScore`; nothing is recomputed client-side, so the
breakdown cannot drift from the total the engine persisted. The total itself is
the expander — the number people act on is the way into the maths behind it.
Colour is a monochrome navy ramp ordered by weight, not a categorical palette:
criteria are not states, and "quality: green" would read as a pass.

**The award page was rebuilt, not restyled.** Allocation was two free-text boxes
asking for `quoteId` and `rfqLineId` — both ULIDs nobody can type. They are now
pickers over the actual quotes and lines. The 500-character variance
justification was described in prose and enforced only server-side, so a buyer
could write a paragraph and be rejected on submit; it is now a live gate that
only applies when the allocation actually moves away from L1.

**Vendor scorecard.** Seven metrics that were a column of bare numbers now show
against the scale they are measured on — but only where a scale exists:

- OTIF, quality and dispute rate are banded good/watch/problem (dispute rate
  inverted, since lower is better).
- Win rate and RFQ participation render **neutral**. They have no target: a 45%
  RFQ win rate is a healthy supplier, and my first cut coloured it red by
  applying OTIF-shaped thresholds — inventing a judgement the data does not
  support.
- Response time (hours) and payment cycle (days) get no bar at all. They are
  unbounded with no target in the API, so a bar would need an invented
  denominator. A fake scale is worse than no scale.

**Another honesty fix, same family as the sandbox chips.** `insufficientData`
rendered "Cold start — under 3 transactions" *next to a confident green grade
pill*. The caveat was there; the colour still said "good". The grade now goes
neutral and gains a **Provisional** chip.

**Bugs found and fixed en route**

| Bug | Where | Fix |
|---|---|---|
| `bg-surface` / `bg-surface-2` were never tokens in this system — 14 dead classes across 8 files, so those inputs and table headers rendered with **no background at all** | vendors, sourcing, team, vendor portal | Mapped onto the real tokens (`bg-panel` / `bg-canvas`) |
| `Date.now()` during render — hydration mismatch | sourcing list countdown | Mounted guard, refreshed each minute |
| Nullable `legalEntityName` stringified into "null · CATEGORY" | vendor 360, onboarding detail | Filtered join |
| Raw `font-mono` instead of the system's `.font-numeric` (no tabular figures) | sourcing list, evaluate | Swapped |

### Remaining

| Phase | Scope | Status |
|---|---|---|
| 3 | Analytics, MSME §15 aging/compliance | not started |
| 4 | Contracts, inventory (13 pages), items, settings, team, vendor portal (18 pages), audit | not started |

Everything not yet converted still renders correctly — the token layer is
global, so unconverted pages picked up the new palette automatically. What they
lack is `PageHeader`, the shared states, and a verified mobile pass.

**Before starting Phase 2**, sweep the remaining pages for the same honesty
violations rather than assuming they are confined to Phase 1: any page rendering
a provider verdict (vendor 360 risk, contract compliance) needs
`VerificationResult`, and any page with a control that only toasts needs
`NotShipped`.

---

## 6. Verification

- `pnpm typecheck` — clean
- `pnpm lint --max-warnings 0` — clean
- `pnpm build` — 72 static pages generated, all 86 routes compile
- Screenshots taken at 1440px and 390px for every converted page and reviewed
  against the token system before moving on

**Note for whoever picks this up:** do not run `next build` while `pnpm dev` is
running in the same working tree. They share `.next`, and the production build
leaves the dev server serving 404s for its JS chunks until it is restarted.
