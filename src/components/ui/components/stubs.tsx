/**
 * Remaining typed stub for a v6 component not needed yet. KpiCard, StageStrip
 * and the approval chain graduated out of this file into real implementations
 * (kpi-card.tsx, stage-strip.tsx, approval-chain.tsx) during the UI refresh.
 */
import * as React from 'react';

import { cn } from '../lib/cn';

export interface HoverPreviewCardProps {
  children: React.ReactNode;
  className?: string;
}

// TODO — full hover-preview card with entity summary.
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
