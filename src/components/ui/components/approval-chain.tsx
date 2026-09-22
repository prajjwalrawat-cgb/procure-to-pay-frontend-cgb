'use client';

/**
 * The approval routing chain, drawn as a route rather than a row of badges.
 *
 * The engine behind this supports multi-step, conditional, parallel and
 * escalating approvals, and the UI was flattening all of it into a line of
 * pills — so "Finance and the plant head must both sign, then the CFO" and
 * "three people in a queue" looked identical. This component draws the actual
 * topology:
 *
 *   ●  sequential steps sit on a single spine
 *   ╠  a parallel group branches off it, bracketed, labelled with its join rule
 *   ◉  the current step is ringed in gold — the one place a person must act
 *
 * SLA state is on the node, not in a separate column, because "who is late" is
 * the question this component exists to answer.
 */

import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Clock,
  MinusCircle,
  X,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Pill } from './pill';
import { formatDateTime } from '@/lib/format';

export interface ApprovalChainStep {
  approvalId?: string | null;
  stepNo: number;
  name: string;
  role: string;
  slaHours: number;
  parallelGroup: string | null;
  approverName: string | null;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'DELEGATED';
  decidedAt?: string | null;
  comment?: string | null;
  slaDueAt?: string | null;
  slaStatus?: 'ok' | 'warn' | 'breach' | 'done';
  isCurrent?: boolean;
  isEscalation?: boolean;
  delegatedFromName?: string | null;
  skipped?: boolean;
  skipReason?: string | null;
  unresolved?: boolean;
  unresolvedReason?: string | null;
}

// ── Time ────────────────────────────────────────────────────────────────────

/** "6h left" / "2d overdue" — the only two things anyone reads off an SLA. */
function slaLabel(dueAt: string, now: number): { text: string; overdue: boolean } {
  const diffMs = new Date(dueAt).getTime() - now;
  const overdue = diffMs < 0;
  const mins = Math.round(Math.abs(diffMs) / 60000);
  const text =
    mins < 60
      ? `${mins}m`
      : mins < 60 * 48
        ? `${Math.round(mins / 60)}h`
        : `${Math.round(mins / 1440)}d`;
  return { text: overdue ? `${text} overdue` : `${text} left`, overdue };
}

function decidedLabel(iso: string): string {
  return formatDateTime(iso);
}

/** `PLANT_HEAD` → `Plant head` */
function roleLabel(role: string): string {
  const s = role.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Node ────────────────────────────────────────────────────────────────────

type NodeState = 'approved' | 'rejected' | 'changes' | 'delegated' | 'current' | 'pending' | 'skipped';

function nodeState(s: ApprovalChainStep): NodeState {
  if (s.skipped) return 'skipped';
  switch (s.decision) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'CHANGES_REQUESTED':
      return 'changes';
    case 'DELEGATED':
      return 'delegated';
    default:
      return s.isCurrent ? 'current' : 'pending';
  }
}

const NODE_ICON: Record<NodeState, React.ElementType | null> = {
  approved: Check,
  rejected: X,
  changes: ArrowRightLeft,
  delegated: ArrowRightLeft,
  current: Clock,
  pending: null,
  skipped: MinusCircle,
};

function ChainNode({ state }: { state: NodeState }): React.JSX.Element {
  const Icon = NODE_ICON[state];
  return (
    <span
      aria-hidden
      className={cn(
        'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
        state === 'approved' && 'border-accent bg-accent text-white',
        state === 'rejected' && 'border-danger bg-danger text-white',
        state === 'changes' && 'border-warn bg-warn text-white',
        state === 'delegated' && 'border-info bg-info text-white',
        // Gold ring = the step a human must act on. Gold is reserved for
        // consequence, and "you are the blocker" qualifies.
        state === 'current' && 'border-gold bg-gold-wash text-gold-ink animate-ledger-pulse',
        state === 'pending' && 'border-line bg-panel text-faint',
        state === 'skipped' && 'border-line bg-canvas text-faint',
      )}
    >
      {Icon && <Icon className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

function DecisionPill({ s }: { s: ApprovalChainStep }): React.JSX.Element {
  const state = nodeState(s);
  const label =
    state === 'skipped'
      ? 'Skipped'
      : state === 'current'
        ? 'Awaiting decision'
        : state === 'pending'
          ? 'Pending'
          : s.decision.charAt(0) + s.decision.slice(1).toLowerCase().replace(/_/g, ' ');

  const variant =
    state === 'approved'
      ? 'success'
      : state === 'rejected'
        ? 'danger'
        : state === 'changes'
          ? 'warn'
          : state === 'delegated'
            ? 'info'
            : state === 'current'
              ? 'outline'
              : 'gray';

  return (
    <Pill variant={variant} dot={state !== 'skipped'}>
      {label}
    </Pill>
  );
}

// ── Step row ────────────────────────────────────────────────────────────────

function StepRow({
  s,
  now,
}: {
  s: ApprovalChainStep;
  now: number | null;
}): React.JSX.Element {
  const state = nodeState(s);
  const sla =
    now !== null && s.slaDueAt && (state === 'current' || state === 'pending')
      ? slaLabel(s.slaDueAt, now)
      : null;

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <ChainNode state={state} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              'text-body-sm font-medium',
              state === 'skipped' ? 'text-faint line-through' : 'text-ink',
            )}
          >
            {s.approverName ?? roleLabel(s.role)}
          </span>
          <DecisionPill s={s} />
          {s.isEscalation && (
            <span className="text-warn inline-flex items-center gap-0.5 text-micro font-semibold ">
              <AlertTriangle className="h-3 w-3" aria-hidden /> Escalated
            </span>
          )}
          {sla && (
            <span
              className={cn(
                'font-numeric text-micro',
                sla.overdue ? 'text-danger font-semibold' : 'text-muted',
              )}
            >
              {sla.text}
            </span>
          )}
        </div>

        <p className="text-muted mt-0.5 text-micro">
          Step {s.stepNo}, {s.name}
          {s.approverName && `, ${roleLabel(s.role)}`}
          {s.delegatedFromName && `, delegated from ${s.delegatedFromName}`}
        </p>

        {s.decidedAt && (
          <p className="font-numeric text-faint text-micro">{decidedLabel(s.decidedAt)}</p>
        )}
        {s.comment && (
          <p className="border-line text-text mt-1 border-l-2 pl-2 text-micro italic">
            “{s.comment}”
          </p>
        )}
        {s.skipped && s.skipReason && (
          <p className="text-faint text-micro">{s.skipReason}</p>
        )}
        {s.unresolved && (
          <p className="text-danger mt-0.5 text-micro">
            No approver resolved{s.unresolvedReason ? ` — ${s.unresolvedReason}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Grouping ────────────────────────────────────────────────────────────────

interface Segment {
  kind: 'single' | 'parallel';
  group: string | null;
  steps: ApprovalChainStep[];
}

/**
 * Collapses consecutive steps that share a `parallelGroup` into one segment.
 * A group of one is still sequential — a bracket around a single node would
 * imply a branch that does not exist.
 */
function segment(steps: ApprovalChainStep[]): Segment[] {
  const out: Segment[] = [];
  for (const s of steps) {
    const last = out[out.length - 1];
    if (s.parallelGroup && last?.group === s.parallelGroup) {
      last.steps.push(s);
      last.kind = 'parallel';
    } else {
      out.push({ kind: 'single', group: s.parallelGroup, steps: [s] });
    }
  }
  return out;
}

// ── Chain ───────────────────────────────────────────────────────────────────

export interface ApprovalChainProps {
  steps: ApprovalChainStep[];
  className?: string;
}

export function ApprovalChain({
  steps,
  className,
}: ApprovalChainProps): React.JSX.Element {
  // SLA countdowns are relative to "now", which differs between the server
  // render and the client hydration. Computing only after mount keeps the two
  // trees identical and avoids a hydration mismatch.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const segments = React.useMemo(() => segment(steps), [steps]);

  if (steps.length === 0) {
    return (
      <p className="text-muted text-caption">No approval route applies to this document.</p>
    );
  }

  return (
    <ol className={cn('relative flex flex-col', className)}>
      {segments.map((seg, i) => {
        const last = i === segments.length - 1;

        if (seg.kind === 'parallel') {
          return (
            <li key={`${seg.group}-${i}`} className="relative">
              {/* Spine behind the bracket */}
              {!last && (
                <span
                  aria-hidden
                  className="bg-line absolute left-3 top-0 h-full w-px"
                />
              )}
              <div className="border-line bg-canvas/50 relative ml-1 rounded-lg border border-dashed py-1.5 pl-2 pr-2.5">
                <p className="text-faint mb-0.5 pl-8 text-micro font-semibold ">
                  In parallel, all {seg.steps.length} must approve
                </p>
                {seg.steps.map((s) => (
                  <StepRow key={s.approvalId ?? `${s.stepNo}-${s.role}`} s={s} now={now} />
                ))}
              </div>
            </li>
          );
        }

        const s = seg.steps[0];
        return (
          <li key={s.approvalId ?? `${s.stepNo}-${s.role}`} className="relative">
            {!last && (
              <span aria-hidden className="bg-line absolute left-3 top-6 h-full w-px" />
            )}
            <StepRow s={s} now={now} />
          </li>
        );
      })}
    </ol>
  );
}
