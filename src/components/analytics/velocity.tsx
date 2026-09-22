'use client';

import type { CycleStage, VelocityResponse } from '@/lib/shared';
import { InfoTip, KpiCard, cn } from '@/components/ui';

import { humanise } from '@/lib/format';

import { Panel, PanelRow, Section, TileError, TileRow, count, days, hours, type Q } from './primitives';

/**
 * Median bar with the P90 tail as a lighter extension of the same hue, on
 * one scale shared by all three stages — so "PO → receipt takes twice as long
 * as requisition → PO" reads straight off the lengths. Two tints of one hue
 * rather than two categorical colours: it's one measure at two percentiles,
 * not two series.
 */
function StageRow({ stage, max }: { stage: CycleStage; max: number }): React.JSX.Element {
  const { medianDays: m, p90Days: p90, n } = stage;
  const measured = m != null && n > 0;
  const medianW = measured && max > 0 ? (m / max) * 100 : 0;
  const tailW = measured && p90 != null && p90 > m && max > 0 ? ((p90 - m) / max) * 100 : 0;
  const summary = measured
    ? `${stage.label}: median ${days(m)}, P90 ${days(p90)}, ${count(n)} measured`
    : `${stage.label}: nothing measured in this range`;

  return (
    <InfoTip content={summary}>
      <div
        tabIndex={0}
        aria-label={summary}
        className="hover:bg-canvas focus-visible:bg-canvas duration-hover flex flex-col gap-2 rounded-xs px-1.5 py-2.5 transition-colors focus-visible:outline-none"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-text text-body-sm font-medium">
            {stage.label}
            <span className="text-faint font-numeric ml-2 text-micro font-normal">
              n = {count(n)}
            </span>
          </span>
          {measured ? (
            <span className="font-numeric flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-ink text-body-sm font-semibold">{days(m)}</span>
              <span className="text-muted text-caption">P90 {days(p90)}</span>
            </span>
          ) : (
            <span className="text-faint text-caption">Nothing measured</span>
          )}
        </div>
        <div className="flex h-3 items-center gap-0.5" aria-hidden>
          {measured && (
            <>
              <span
                className={cn('bg-accent h-3 min-w-0.5', tailW === 0 && 'rounded-r-xs')}
                style={{ width: `${medianW}%` }}
              />
              {tailW > 0 && (
                <span className="bg-accent-soft h-3 rounded-r-xs" style={{ width: `${tailW}%` }} />
              )}
            </>
          )}
        </div>
      </div>
    </InfoTip>
  );
}

function Legend(): React.JSX.Element {
  return (
    <div className="text-muted flex items-center gap-3 text-caption" aria-hidden>
      <span className="flex items-center gap-1.5">
        <span className="bg-accent h-2.5 w-2.5 rounded-xs" /> Median
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-accent-soft h-2.5 w-2.5 rounded-xs" /> P90
      </span>
    </div>
  );
}

export function VelocitySection({ query }: { query: Q<VelocityResponse> }): React.JSX.Element {
  const d = query.data;
  const stages = d?.stages ?? [];
  const max = Math.max(0, ...stages.map((s) => s.p90Days ?? s.medianDays ?? 0));
  const slow = d?.slowestStep ?? null;

  return (
    <Section
      id="velocity"
      title="Operational velocity"
      description="How long each hand-off takes in the selected range; the queue figures are live."
    >
      <TileRow>
        <KpiCard
          label="Pending approvals"
          isLoading={query.isLoading}
          value={d ? count(d.queue.pendingApprovals) : '—'}
          footnote={d ? 'Documents waiting, now' : undefined}
        />
        <KpiCard
          label="POs awaiting receipt"
          isLoading={query.isLoading}
          value={d ? count(d.queue.pendingGrns) : '—'}
          footnote={d ? 'Issued, no goods receipt yet' : undefined}
        />
        <KpiCard
          label="Payment runs pending"
          isLoading={query.isLoading}
          value={d ? count(d.queue.pendingPaymentRuns) : '—'}
          footnote={d ? 'Not yet released' : undefined}
        />
        <KpiCard
          label="Slowest approval step"
          isLoading={query.isLoading}
          value={d ? (slow ? hours(slow.medianHours) : '—') : '—'}
          footnote={
            d
              ? slow
                ? `${slow.stepName} · ${humanise(slow.documentType)} · n = ${count(slow.n)}`
                : 'Not enough decisions in this range'
              : undefined
          }
          help="The approval step with the longest median time to a decision, among steps with enough decisions in the range to be meaningful."
        />
      </TileRow>
      <TileError query={query} what="the velocity figures" />
      <PanelRow single>
        <Panel
          title="Cycle time by stage"
          meta="Days per hand-off. Each stage is measured on its own documents, so they don't add up to an end-to-end time."
          aside={<Legend />}
          query={query}
          isEmpty={stages.every((s) => s.n === 0)}
        >
          <div className="flex flex-col gap-1">
            {stages.map((s) => (
              <StageRow key={s.key} stage={s} max={max} />
            ))}
          </div>
        </Panel>
      </PanelRow>
    </Section>
  );
}
