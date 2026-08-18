'use client';

import type { AuditRecordView, AuditVerifyResult } from '@/lib/shared';
import { Button, Pill } from '@/components/ui';
import { useMemo, useState } from 'react';

import { exportUrl, useAuditLog, verifyChain, type AuditFilters } from '@/lib/api/audit';
import { useSessionStore } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';

const ACTIONS = [
  'DOCUMENT_ROUTED',
  'APPROVAL_DECIDED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
  'MATRIX_ACTIVATED',
  'invoice.created',
];
const ENTITY_TYPES = ['Invoice', 'ApprovalMatrix', 'User', 'Delegation'];

function thirtyDaysAgoIso(nowMs: number): string {
  return new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export default function AuditPage(): React.JSX.Element {
  // Computed once on mount; audit is not a live-ticking view.
  const defaultFrom = useMemo(() => thirtyDaysAgoIso(Date.now()), []);
  const [search, setSearch] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [openRow, setOpenRow] = useState<AuditRecordView | null>(null);
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResult | null>(null);
  const token = useSessionStore((s) => s.accessToken);
  const toast = useToastStore((s) => s.push);

  const filters: AuditFilters = {
    from: defaultFrom,
    search: search || undefined,
    action: actions.length ? actions : undefined,
    entityType: entityTypes.length ? entityTypes : undefined,
  };
  const { data, isLoading } = useAuditLog(filters);

  const toggle = (list: string[], set: (v: string[]) => void, value: string): void =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const runVerify = async (): Promise<void> => {
    const result = await verifyChain(filters);
    setVerifyResult(result);
  };

  const download = async (kind: 'csv' | 'pdf'): Promise<void> => {
    const res = await fetch(exportUrl(kind, filters), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      toast('Export failed', 'error');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = kind === 'csv' ? 'audit-log.csv' : 'audit-report.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Audit log
          </h1>
          <p className="text-muted text-[13px]">
            Tamper-evident, hash-chained. Last 30 days.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => void download('csv')}>
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void download('pdf')}>
            Export PDF
          </Button>
          <Button variant="accent" size="sm" onClick={() => void runVerify()}>
            Verify chain
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actor or entity id…"
          className="border-line w-64 rounded-sm border px-2.5 py-1.5 text-[13px] outline-none"
        />
        {ACTIONS.map((a) => (
          <Chip
            key={a}
            label={a}
            on={actions.includes(a)}
            onClick={() => toggle(actions, setActions, a)}
          />
        ))}
        {ENTITY_TYPES.map((e) => (
          <Chip
            key={e}
            label={e}
            on={entityTypes.includes(e)}
            onClick={() => toggle(entityTypes, setEntityTypes, e)}
          />
        ))}
      </div>

      {isLoading && <div className="text-muted text-[13px]">Loading…</div>}

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="border-line text-faint border-b text-[11px] uppercase tracking-wide">
            <tr>
              <th className="p-2 text-left">Timestamp</th>
              <th className="p-2 text-left">Actor</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">Entity</th>
              <th className="p-2 text-left">Hash</th>
              <th className="p-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenRow(r)}
                className="border-line hover:bg-canvas cursor-pointer border-b last:border-0"
                data-testid="audit-row"
              >
                <td className="font-numeric text-muted p-2">
                  {new Date(r.timestamp).toLocaleString('en-IN')}
                </td>
                <td className="p-2">{r.actorName ?? r.actorType}</td>
                <td className="p-2">
                  <Pill variant="gray">{r.action}</Pill>
                </td>
                <td className="font-numeric p-2">
                  {r.entityType} <span className="text-faint">{r.entityId}</span>
                </td>
                <td className="font-numeric text-faint p-2">
                  {r.hashCurrent.slice(0, 10)}…
                </td>
                <td className="text-muted p-2">{r.ipAddress ?? '—'}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="text-muted p-6 text-center">
                  No events for these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openRow && <AuditDrawer row={openRow} onClose={() => setOpenRow(null)} />}
      {verifyResult && (
        <VerifyModal result={verifyResult} onClose={() => setVerifyResult(null)} />
      )}
    </div>
  );
}

function Chip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-full border px-2.5 py-0.5 text-[11px] font-medium ' +
        (on ? 'border-accent bg-accent-wash text-accent-2' : 'border-line text-muted')
      }
    >
      {label}
    </button>
  );
}

function AuditDrawer({
  row,
  onClose,
}: {
  row: AuditRecordView;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-panel border-line h-full w-full max-w-lg overflow-y-auto border-l p-5"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-ink text-[15px] font-semibold">{row.action}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <dl className="mb-4 flex flex-col gap-1 text-[12px]">
          <Row k="Entity" v={`${row.entityType} · ${row.entityId}`} />
          <Row k="Actor" v={row.actorName ?? row.actorType} />
          <Row k="When" v={new Date(row.timestamp).toLocaleString('en-IN')} />
          <Row k="Hash" v={row.hashCurrent} mono />
          <Row k="Prev hash" v={row.hashPrevious ?? '— (chain root)'} mono />
        </dl>
        <div className="grid grid-cols-2 gap-3">
          <JsonBlock title="Before" value={row.before} />
          <JsonBlock title="After" value={row.after} />
        </div>
      </div>
    </div>
  );
}

function JsonBlock({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown> | null;
}): React.JSX.Element {
  return (
    <div>
      <div className="text-faint mb-1 text-[10px] font-semibold uppercase">{title}</div>
      <pre className="border-line bg-canvas font-numeric overflow-x-auto rounded-sm border p-2 text-[11px]">
        {value ? JSON.stringify(value, null, 2) : '—'}
      </pre>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
}: {
  k: string;
  v: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={'text-text text-right ' + (mono ? 'font-numeric break-all' : '')}>
        {v}
      </dd>
    </div>
  );
}

function VerifyModal({
  result,
  onClose,
}: {
  result: AuditVerifyResult;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-panel border-line w-full max-w-md rounded-xl border p-5 shadow-lg"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        {result.verified ? (
          <div className="bg-accent-wash text-accent-2 rounded-lg p-4 text-[13px] font-medium">
            Chain verified · {result.eventsChecked} events · no tampering detected
          </div>
        ) : (
          <div className="bg-danger-wash text-danger rounded-lg p-4 text-[13px] font-medium">
            Chain BROKEN · first break at{' '}
            <span className="font-numeric">{result.firstBreakAt}</span>. See the incident
            runbook (docs/adr/006-audit-hash-chain.md).
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
