'use client';

import { useState } from 'react';

import { useRefCard } from '@/lib/api/invoices';
import { inrCompact } from '@/lib/format';

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

  let timer: ReturnType<typeof setTimeout>;
  const onEnter = (): void => {
    timer = setTimeout(() => {
      setArmed(true);
      setOpen(true);
    }, 300);
  };
  const onLeave = (): void => {
    clearTimeout(timer);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      data-ref={`${kind}:${id}`}
    >
      <span className="text-accent-2 cursor-default font-medium underline decoration-dotted underline-offset-2">
        {children}
      </span>
      {open && data && (
        <span className="border-line bg-panel absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border p-3 text-[12px] shadow-lg">
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
            A · {String(data.riskScore ?? '—')}
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
          <span className="font-numeric text-text">{String(data.onTimePct ?? '—')}%</span>
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
        <span className="text-faint">Status: {String(data.status)}</span>
      </span>
    );
  }
  if (kind === 'grn') {
    return (
      <span className="flex flex-col gap-1">
        <span className="text-ink font-semibold">{String(data.number)}</span>
        <span className="text-muted">QC: {String(data.qcStatus)}</span>
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
