'use client';

/**
 * ── THE LEDGER STRIP — the signature element ───────────────────────────────
 *
 * Every action in ProcureFlow is written to a tamper-evident audit chain: each
 * record carries its own hash and the hash of the record before it, so any edit
 * to history breaks the chain and the server can prove it. That is a genuinely
 * unusual property for a P2P product to have, and today it is buried behind an
 * audit-log tab that nobody opens. This component puts it on the face of every
 * document: a physical chain of links, one per recorded event, that a buyer can
 * see is unbroken.
 *
 * ── One honesty constraint that shapes the whole design ────────────────────
 * The hash chain is GLOBAL, not per-document. Record N links to record N-1 in
 * the whole tenant log, not to the previous event on this invoice. So a list
 * filtered to one document will show `hashPrevious` values that legitimately do
 * not match the segment drawn beside them, and a client-side link check across
 * a filtered list would report false breaks.
 *
 * Therefore: this component NEVER computes integrity itself. It renders the
 * document's events as links in the ledger, and the integrity verdict comes
 * from the server's real `/audit/verify` cryptographic pass. Until that has
 * been run the strip states plainly that it is unverified rather than showing a
 * reassuring green by default. An unverified chain must never look verified.
 */

import { Check, ChevronDown, Link2Off, Loader2, ShieldCheck, ShieldQuestion } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Button } from './button';
import { EmptyState } from './data-state';
import { InfoTip } from './tooltip';
import { formatDateTime } from '@/lib/format';

export interface LedgerEvent {
  id: string;
  timestamp: string;
  actorName: string | null;
  actorType: string;
  action: string;
  hashCurrent: string;
  hashPrevious: string | null;
}

export type LedgerVerdict =
  | { state: 'unverified' }
  | { state: 'verifying' }
  | { state: 'intact'; eventsChecked: number }
  | { state: 'broken'; firstBreakAt: string | null };

function shortHash(hash: string): string {
  return hash.length <= 12 ? hash : `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function timeLabel(iso: string): string {
  return formatDateTime(iso);
}

/** `INVOICE_APPROVED` → `Invoice approved` */
function actionLabel(action: string): string {
  const s = action.replace(/[._]/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── The chain itself ────────────────────────────────────────────────────────

/**
 * The seam colour is the whole point, so it is derived in one place:
 *   intact    → gold, the only place gold appears without a click attached
 *   broken    → danger, and the seam is drawn severed
 *   otherwise → neutral line; deliberately unremarkable
 */
function seamClasses(verdict: LedgerVerdict): string {
  switch (verdict.state) {
    case 'intact':
      return 'bg-gold';
    case 'broken':
      return 'bg-danger';
    default:
      return 'bg-faint/45';
  }
}

/**
 * Unverified links are drawn as hollow rings rather than pale fills. Filling
 * them in `line` made the chain almost disappear against the panel, which
 * defeats the point — the strip has to read as a chain before anyone will
 * think to verify it. Hollow says "present but unconfirmed", which is exactly
 * the state.
 */
function linkClasses(verdict: LedgerVerdict, selected: boolean): string {
  switch (verdict.state) {
    case 'intact':
      return cn('border-panel', selected ? 'bg-gold-ink' : 'bg-gold');
    case 'broken':
      return cn('border-panel', selected ? 'bg-danger' : 'bg-danger/70');
    default:
      return selected ? 'border-ink bg-ink' : 'border-faint bg-panel';
  }
}

function VerdictLine({ verdict }: { verdict: LedgerVerdict }): React.JSX.Element {
  switch (verdict.state) {
    case 'verifying':
      return (
        <span className="text-muted inline-flex items-center gap-1.5 text-[11px]">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Verifying…
        </span>
      );
    case 'intact':
      return (
        <span className="text-gold-ink inline-flex items-center gap-1.5 text-[11px] font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Chain intact
          <span className="font-numeric text-muted font-normal">
            {`, ${verdict.eventsChecked.toLocaleString('en-IN')} checked`}
          </span>
        </span>
      );
    case 'broken':
      return (
        <span className="text-danger inline-flex items-center gap-1.5 text-[11px] font-semibold">
          <Link2Off className="h-3.5 w-3.5" aria-hidden />
          Chain broken
          {verdict.firstBreakAt && (
            <span className="font-numeric font-normal">
            {`, first at ${timeLabel(verdict.firstBreakAt)}`}
            </span>
          )}
        </span>
      );
    default:
      return (
        <InfoTip content="These events are recorded in a tamper-evident chain. Run a verification to cryptographically confirm nothing has been altered.">
          <span className="text-muted inline-flex cursor-help items-center gap-1.5 text-[11px]">
            <ShieldQuestion className="h-3.5 w-3.5" aria-hidden />
            Not yet verified
          </span>
        </InfoTip>
      );
  }
}

export interface LedgerStripProps {
  events: LedgerEvent[];
  verdict?: LedgerVerdict;
  isLoading?: boolean;
  /** Wire to the real `/audit/verify` call. Omit to hide the verify action. */
  onVerify?: () => void;
  /** Deep-link to the full audit log, pre-filtered to this document. */
  auditHref?: string;
  title?: string;
  className?: string;
}

export function LedgerStrip({
  events,
  verdict = { state: 'unverified' },
  isLoading,
  onVerify,
  auditHref,
  title = 'Audit ledger',
  className,
}: LedgerStripProps): React.JSX.Element {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  // Oldest → newest, so the chain reads left to right like a ledger.
  const ordered = React.useMemo(
    () => [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [events],
  );

  const active = ordered.find((e) => e.id === selected) ?? null;

  return (
    <section
      className={cn('border-line bg-panel rounded-lg border', className)}
      aria-label={title}
    >
      <header className="border-line flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-faint text-[11px] font-medium ">
            {title}
          </h3>
          <VerdictLine verdict={verdict} />
        </div>
        {onVerify && (
          <Button
            variant="default"
            size="sm"
            onClick={onVerify}
            disabled={verdict.state === 'verifying'}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Verify
          </Button>
        )}
      </header>

      <div className="px-3.5 py-3">
        {isLoading ? (
          <div className="flex items-center gap-1.5" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="bg-line h-px w-4 shrink-0" />}
                <span className="bg-canvas h-3.5 w-3.5 shrink-0 rounded-full" />
              </React.Fragment>
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <EmptyState
            compact
            title="No ledger entries yet"
            detail="Recorded actions on this document will appear here as chain links."
          />
        ) : (
          <>
            {/* The chain. Horizontally scrollable so a long history never
                widens the page — the rail it sits in is narrow by design. */}
            {/* A group of toggle buttons rather than a list: each link expands
                its own detail, and `aria-pressed` is not valid on a listitem. */}
            <div
              className="border-line bg-canvas/50 flex items-center overflow-x-auto rounded-sm border px-3 py-2.5"
              role="group"
              aria-label={`${ordered.length} ledger entries`}
            >
              {ordered.map((e, i) => (
                <React.Fragment key={e.id}>
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn('h-[2px] w-4 shrink-0', seamClasses(verdict))}
                    />
                  )}
                  <InfoTip
                    content={
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold">{actionLabel(e.action)}</span>
                        <span>
                          {e.actorName ?? e.actorType}, {timeLabel(e.timestamp)}
                        </span>
                        <span className="font-numeric opacity-70">
                          {shortHash(e.hashCurrent)}
                        </span>
                      </span>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(selected === e.id ? null : e.id)}
                      aria-pressed={selected === e.id}
                      aria-label={`${actionLabel(e.action)} by ${
                        e.actorName ?? e.actorType
                      } at ${timeLabel(e.timestamp)}`}
                      className={cn(
                        'duration-hover h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-transform',
                        'hover:scale-125',
                        linkClasses(verdict, selected === e.id),
                      )}
                    />
                  </InfoTip>
                </React.Fragment>
              ))}
            </div>

            {/* Selected-link detail. Shows the actual hash pair, because the
                claim is cryptographic and the evidence should be visible. */}
            {active && (
              <dl className="border-line bg-canvas/60 mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-sm border p-2.5 text-[11px]">
                <dt className="text-faint">Action</dt>
                <dd className="text-ink font-medium">{actionLabel(active.action)}</dd>
                <dt className="text-faint">Actor</dt>
                <dd className="text-text">{active.actorName ?? active.actorType}</dd>
                <dt className="text-faint">Time</dt>
                <dd className="font-numeric text-text">{timeLabel(active.timestamp)}</dd>
                <dt className="text-faint">Hash</dt>
                <dd className="font-numeric text-text break-all">{active.hashCurrent}</dd>
                {active.hashPrevious && (
                  <>
                    <dt className="text-faint">Prev</dt>
                    <dd className="font-numeric text-muted break-all">
                      {active.hashPrevious}
                    </dd>
                  </>
                )}
              </dl>
            )}

            {/* Compact event list, collapsed by default so the rail stays short. */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="text-muted hover:text-ink duration-hover inline-flex items-center gap-1 text-[11px] transition-colors"
              >
                <ChevronDown
                  className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')}
                  aria-hidden
                />
                {expanded ? 'Hide' : 'Show'} {ordered.length} event
                {ordered.length === 1 ? '' : 's'}
              </button>

              {auditHref && (
                <a
                  href={auditHref}
                  className="text-info duration-hover text-[11px] font-medium hover:underline"
                >
                  Open in audit log →
                </a>
              )}
            </div>

            {expanded && (
              <ol className="border-line mt-2 flex flex-col gap-1.5 border-t pt-2">
                {[...ordered].reverse().map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-[11px]">
                    <Check className="text-accent mt-[3px] h-3 w-3 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="text-ink font-medium">{actionLabel(e.action)}</span>
                      <span className="text-muted">
                        {' '}
                      {`, ${e.actorName ?? e.actorType}`}
                      </span>
                      <span className="font-numeric text-faint block">
                        {timeLabel(e.timestamp)}, {shortHash(e.hashCurrent)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  );
}
