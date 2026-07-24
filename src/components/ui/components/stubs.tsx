/**
 * Typed, untested stubs for v6 components not needed until later slices
 * (Master Context §6 / Slice 0 UI package scope). They render a minimal shell so
 * imports typecheck; full implementations arrive when their slice lands.
 */
import * as React from 'react';

import { cn } from '../lib/cn';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  delta?: string;
  className?: string;
}

// TODO Slice 8 — full KPI card with sparkline + trend.
export function KpiCard({
  label,
  value,
  delta,
  className,
}: KpiCardProps): React.JSX.Element {
  return (
    <div
      className={cn('border-line bg-panel rounded-lg border p-4 shadow-sm', className)}
    >
      <div className="text-faint text-[11px] uppercase tracking-wide">{label}</div>
      <div className="font-numeric tracking-display text-ink mt-1 text-[20px] font-semibold">
        {value}
      </div>
      {delta && <div className="text-muted mt-0.5 text-[11px]">{delta}</div>}
    </div>
  );
}

export interface ApprovalChainStepProps {
  stepNo: number;
  approver: string;
  state?: 'pending' | 'approved' | 'rejected' | 'current';
  className?: string;
}

// TODO Slice 2 — full approval chain step with SLA + timestamps.
export function ApprovalChainStep({
  stepNo,
  approver,
  state = 'pending',
  className,
}: ApprovalChainStepProps): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-2 text-[13px]', className)}>
      <span className="bg-canvas font-numeric flex h-6 w-6 items-center justify-center rounded-full text-[11px]">
        {stepNo}
      </span>
      <span className="text-text">{approver}</span>
      <span className="text-faint">· {state}</span>
    </div>
  );
}

export interface StageStripProps {
  stages: string[];
  activeIndex: number;
  className?: string;
}

// TODO Slice 1 — full stage strip for document lifecycle.
export function StageStrip({
  stages,
  activeIndex,
  className,
}: StageStripProps): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-1 text-[12px]', className)}>
      {stages.map((stage, i) => (
        <span
          key={stage}
          className={cn(
            'rounded-xs px-2 py-0.5',
            i === activeIndex ? 'bg-accent-wash text-accent-2' : 'bg-canvas text-muted',
          )}
        >
          {stage}
        </span>
      ))}
    </div>
  );
}

export interface HoverPreviewCardProps {
  children: React.ReactNode;
  className?: string;
}

// TODO Slice 1 — full hover-preview card with entity summary.
export function HoverPreviewCard({
  children,
  className,
}: HoverPreviewCardProps): React.JSX.Element {
  return (
    <div
      className={cn('border-line bg-panel rounded-lg border p-3 shadow-lg', className)}
    >
      {children}
    </div>
  );
}
