'use client';

/**
 * The document lifecycle, as a track.
 *
 * Answers "where is this, and what happens next" without opening anything. Used
 * in the document header on every transactional detail page — requisition, PO,
 * GRN, invoice, payment run — so the P2P spine reads the same at every stop.
 *
 * A terminal failure (rejected, cancelled, failed) is not "stage N of M": the
 * track stops there and the remaining stages are dropped rather than greyed,
 * because a cancelled PO is never going to reach "Received" and implying
 * otherwise is misleading.
 */

import { Check, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface Stage {
  key: string;
  label: string;
  /** Shown under the label when the stage is done, e.g. "14 Aug". */
  at?: string | null;
}

export interface StageStripProps {
  stages: Stage[];
  /** Index of the stage currently in progress. */
  activeIndex: number;
  /** Renders the active stage as a terminal failure and truncates the track. */
  failed?: boolean;
  /** Label for the failure, e.g. "Rejected". Defaults to the active stage label. */
  failedLabel?: string;
  className?: string;
}

export function StageStrip({
  stages,
  activeIndex,
  failed,
  failedLabel,
  className,
}: StageStripProps): React.JSX.Element {
  const visible = failed ? stages.slice(0, activeIndex + 1) : stages;

  return (
    // Scrolls rather than squeezes. An eight-stage PO on a 390px screen gives
    // each label ~40px if the track is allowed to compress, which collides the
    // labels into unreadable mush — so each stage keeps a floor width and the
    // track scrolls sideways instead.
    <ol
      className={cn(
        'flex w-full items-start overflow-x-auto pb-1',
        className,
      )}
      aria-label="Document progress"
    >
      {visible.map((stage, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const isFail = Boolean(failed) && active;
        const last = i === visible.length - 1;

        return (
          <li
            key={stage.key}
            className={cn('flex shrink-0 items-start', !last && 'flex-1')}
            aria-current={active ? 'step' : undefined}
          >
            <div className="flex w-[68px] shrink-0 flex-col items-center gap-1 px-1 sm:w-auto sm:min-w-[72px]">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-micro font-semibold',
                  done && 'border-accent bg-accent text-white',
                  active && !isFail && 'border-gold bg-gold-wash text-gold-ink',
                  isFail && 'border-danger bg-danger text-white',
                  !done && !active && 'border-line bg-panel text-faint',
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                ) : isFail ? (
                  <X className="h-3 w-3" strokeWidth={3} aria-hidden />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  'text-center text-micro leading-tight',
                  active ? 'text-ink font-semibold' : done ? 'text-text' : 'text-faint',
                )}
                title={isFail ? (failedLabel ?? stage.label) : stage.label}
              >
                {isFail ? (failedLabel ?? stage.label) : stage.label}
              </span>
              {stage.at && (
                <span className="font-numeric text-faint text-micro">{stage.at}</span>
              )}
            </div>

            {!last && (
              <span
                aria-hidden
                className={cn(
                  'mt-[9px] h-[2px] min-w-4 flex-1',
                  done ? 'bg-accent' : 'bg-line',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
