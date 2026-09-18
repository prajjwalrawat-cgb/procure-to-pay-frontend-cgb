'use client';

import type { AuditRecordView, AuditVerifyResult } from '@/lib/shared';
import { Button, PageHeader, Pill } from '@/components/ui';
import { useMemo, useState } from 'react';

import { exportUrl, useAuditLog, verifyChain, type AuditFilters } from '@/lib/api/audit';
import { useSessionStore } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';
import { formatDateTime } from '@/lib/format';

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
    <div>
      <PageHeader
        title="Audit log"
        description="Tamper-evident, hash-chained. Last 30 days."
        actions={
          <>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => void download('csv')}>
                Export CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void download('pdf')}>
                Export PDF
              </Button>
              <Button variant="primary" size="sm" onClick={() => void runVerify()}>
                Verify chain
              </Button>
            </div>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actor or entity id…"
          className="w-64 rounded-sm border border-line px-2.5 py-1.5 text-[13px] outline-none"
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

      {isLoading && <div className="text-[13px] text-muted">Loading…</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-line border-b text-left text-[12px] text-muted">
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
                className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas"
                data-testid="audit-row"
              >
                <td className="font-numeric p-2 text-muted">
                  {formatDateTime(r.timestamp)}
                </td>
                <td className="p-2">{r.actorName ?? r.actorType}</td>
                <td className="p-2">
                  <Pill variant="gray">{r.action}</Pill>
                </td>
                <td className="font-numeric p-2">
                  {r.entityType} <span className="text-faint">{r.entityId}</span>
                </td>
                <td className="font-numeric p-2 text-faint">
                  {r.hashCurrent.slice(0, 10)}…
                </td>
                <td className="p-2 text-muted">{r.ipAddress ?? '—'}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="presentation"
      onClick={onClose}
    >
      <div className="h-full w-full max-w-lg overflow-y-auto border-l border-line bg-panel p-5"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-ink">{row.action}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <dl className="mb-4 flex flex-col gap-1 text-[12px]">
          <Row k="Entity" v={`${row.entityType}, ${row.entityId}`} />
          <Row k="Actor" v={row.actorName ?? row.actorType} />
          <Row k="When" v={formatDateTime(row.timestamp)} />
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
      <div className="mb-1 text-[10px] font-semibold text-faint">{title}</div>
      <pre className="font-numeric overflow-x-auto rounded-sm border border-line bg-canvas p-2 text-[11px]">
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
      <dd className={'text-right text-text ' + (mono ? 'font-numeric break-all' : '')}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
      role="presentation"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-lg"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        {result.verified ? (
          <div className="rounded-lg bg-accent-wash p-4 text-[13px] font-medium text-accent-2">
            Chain verified across {result.eventsChecked} events — no tampering detected
          </div>
        ) : (
          <div className="rounded-lg bg-danger-wash p-4 text-[13px] font-medium text-danger">
            Chain broken — first break at{' '}
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
