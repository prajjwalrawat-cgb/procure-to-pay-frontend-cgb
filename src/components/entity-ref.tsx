'use client';

import { useRef, useState } from 'react';

import { useRefCard } from '@/lib/api/invoices';
import { inrCompact, statusLabel } from '@/lib/format';

type Kind = 'vendor' | 'po' | 'grn' | 'invoice';

/**
 * A referenced entity with a lazy hover-preview card (Master Context §6).
 * Card fetches after a 300ms hover delay and is cached 5 min by TanStack Query.
 */
export function EntityRef({
  kind,
  id,
  children,
}: {
  kind: Kind;
  id: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);
  const { data } = useRefCard(armed ? kind : null, armed ? id : null);

  // A ref, not a render-scoped variable: a re-render between hover-in and
  // hover-out (a background refetch) lost the handle, and the card then opened
  // after the pointer had already left.
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onEnter = (): void => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setArmed(true);
      setOpen(true);
    }, 300);
  };
  const onLeave = (): void => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      data-ref={`${kind}:${id}`}
    >
      <span className="text-accent-2 hover:text-accent cursor-default font-medium underline-offset-2 hover:underline">
        {children}
      </span>
      {open && data && (
        <span className="border-line bg-panel absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border p-3 text-caption shadow-lg">
          <HoverBody data={data} />
        </span>
      )}
    </span>
  );
}

function HoverBody({ data }: { data: Record<string, unknown> }): React.JSX.Element {
  const kind = data.kind as string;
  if (kind === 'vendor') {
    return (
      <span className="flex flex-col gap-1.5">
        <span className="text-ink font-semibold">{String(data.name)}</span>
        <span className="text-muted flex items-center justify-between">
          <span>Risk score</span>
          <span className="font-numeric text-text">
            {data.riskScore != null ? String(data.riskScore) : '—'}
          </span>
        </span>
        <span className="text-muted flex items-center justify-between">
          <span>FYTD spend</span>
          <span className="font-numeric text-text">
            {inrCompact(String(data.fytdSpend ?? '0'))}
          </span>
        </span>
        <span className="text-muted flex items-center justify-between">
          <span>On-time (OTIF)</span>
          <span className="font-numeric text-text">
            {data.onTimePct != null ? `${String(data.onTimePct)}%` : '—'}
          </span>
        </span>
      </span>
    );
  }
  if (kind === 'po') {
    return (
      <span className="flex flex-col gap-1">
        <span className="text-ink font-semibold">{String(data.number)}</span>
        <span className="text-muted">{String(data.vendorName)}</span>
        <span className="font-numeric text-text">
          {inrCompact(String(data.total ?? '0'))}
        </span>
        <span className="text-faint">Status: {statusLabel(String(data.status))}</span>
      </span>
    );
  }
  if (kind === 'grn') {
    return (
      <span className="flex flex-col gap-1">
        <span className="text-ink font-semibold">{String(data.number)}</span>
        <span className="text-muted">
          QC: {data.qcStatus ? statusLabel(String(data.qcStatus)) : '—'}
        </span>
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="text-ink font-semibold">{String(data.number)}</span>
      <span className="text-muted">{String(data.vendorName ?? '')}</span>
      <span className="font-numeric text-text">
        {inrCompact(String(data.grossAmount ?? '0'))}
      </span>
    </span>
  );
}
