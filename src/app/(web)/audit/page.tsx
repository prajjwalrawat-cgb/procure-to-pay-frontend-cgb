'use client';

import type { AuditRecordView, AuditVerifyResult } from '@/lib/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  PageHeader,
  SortableHead,
  TableState,
  useSort,
} from '@/components/ui';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

/** Event keys ("invoice.created", "DOCUMENT_ROUTED") read as words. */
function actionLabel(action: string): string {
  const words = action.replace(/[._]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type SortKey = 'timestamp' | 'actor' | 'action' | 'entity';

export default function AuditPage(): React.JSX.Element {
  // Computed once on mount; audit is not a live-ticking view.
  const defaultFrom = useMemo(() => thirtyDaysAgoIso(Date.now()), []);
  const [search, setSearch] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  // Document pages link here as ?entityId=… ("Open in audit log"). Read once
  // on mount rather than through useSearchParams, which would opt the page out
  // of static rendering and need a Suspense boundary.
  const [entityId, setEntityId] = useState<string | undefined>(undefined);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('entityId');
    if (id) setEntityId(id);
  }, []);
  const [openRow, setOpenRow] = useState<AuditRecordView | null>(null);
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const token = useSessionStore((s) => s.accessToken);
  const toast = useToastStore((s) => s.push);

  const filters: AuditFilters = {
    from: defaultFrom,
    search: search || undefined,
    action: actions.length ? actions : undefined,
    entityType: entityTypes.length ? entityTypes : undefined,
    entityId,
  };
  const { data, isLoading, error, refetch } = useAuditLog(filters);
  const rows = data?.items ?? [];
  const { sorted, sort, toggle: toggleSort } = useSort<AuditRecordView, SortKey>(rows, {
    timestamp: (r) => new Date(r.timestamp),
    actor: (r) => r.actorName ?? r.actorType,
    action: (r) => r.action,
    entity: (r) => `${r.entityType} ${r.entityId}`,
  });
  const filtered = Boolean(search || actions.length || entityTypes.length || entityId);

  const toggle = (list: string[], set: (v: string[]) => void, value: string): void =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const runVerify = async (): Promise<void> => {
    setVerifying(true);
    try {
      setVerifyResult(await verifyChain(filters));
    } catch {
      // A failed request is not a failed verification; say so rather than
      // opening a modal with no verdict in it.
      toast('Could not run chain verification', 'error');
    } finally {
      setVerifying(false);
    }
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

  const clearFilters = (): void => {
    setSearch('');
    setActions([]);
    setEntityTypes([]);
    setEntityId(undefined);
  };

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Tamper-evident and hash-chained. Showing the last 30 days."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void download('csv')}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void download('pdf')}>
              Export PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={verifying}
              onClick={() => void runVerify()}
            >
              {verifying ? 'Verifying…' : 'Verify chain'}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor or entity id…"
            aria-label="Search actor or entity id"
            className="w-full sm:w-72"
          />
          {entityId && (
            <span className="border-line bg-panel text-text inline-flex items-center gap-1 rounded-pill border py-0.5 pl-2.5 pr-1 text-caption">
              Document <span className="font-numeric">{entityId}</span>
              <button
                type="button"
                aria-label="Clear document filter"
                onClick={() => setEntityId(undefined)}
                className="text-muted hover:bg-canvas hover:text-text rounded-full p-0.5"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted mr-1 text-caption">Action</span>
          {ACTIONS.map((a) => (
            <Chip
              key={a}
              label={actionLabel(a)}
              on={actions.includes(a)}
              onClick={() => toggle(actions, setActions, a)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted mr-1 text-caption">Record</span>
          {ENTITY_TYPES.map((e) => (
            <Chip
              key={e}
              label={e.replace(/([a-z])([A-Z])/g, '$1 $2')}
              on={entityTypes.includes(e)}
              onClick={() => toggle(entityTypes, setEntityTypes, e)}
            />
          ))}
        </div>
      </div>

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left">
            <tr>
              <SortableHead label="Timestamp" sortKey="timestamp" sort={sort} onSort={toggleSort} />
              <SortableHead label="Actor" sortKey="actor" sort={sort} onSort={toggleSort} />
              <SortableHead label="Action" sortKey="action" sort={sort} onSort={toggleSort} />
              <SortableHead label="Entity" sortKey="entity" sort={sort} onSort={toggleSort} />
              <th className="text-muted px-3 py-2.5 text-caption font-medium">Hash</th>
              <th className="text-muted px-3 py-2.5 text-caption font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={6}
              isLoading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              isEmpty={rows.length === 0}
              empty={
                filtered
                  ? {
                      title: 'No events match these filters',
                      detail: 'Try a different search, or clear the filters.',
                      action: (
                        <Button variant="secondary" size="sm" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      ),
                    }
                  : {
                      title: 'No events in the last 30 days',
                      detail: 'Approvals, routing and configuration changes are recorded here as they happen.',
                    }
              }
            />
            {!isLoading &&
              !error &&
              sorted.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpenRow(r)}
                  // The row opens the detail drawer, so it has to be reachable
                  // without a mouse too.
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenRow(r);
                    }
                  }}
                  className="border-line hover:bg-canvas cursor-pointer border-b last:border-0"
                  data-testid="audit-row"
                >
                  <td className="font-numeric text-muted px-3 py-3">
                    {formatDateTime(r.timestamp)}
                  </td>
                  <td className="text-text px-3 py-3">{r.actorName ?? r.actorType}</td>
                  <td className="text-text px-3 py-3">{actionLabel(r.action)}</td>
                  <td className="px-3 py-3">
                    <span className="text-text">{r.entityType}</span>{' '}
                    <span className="font-numeric text-faint break-all">{r.entityId}</span>
                  </td>
                  <td className="font-numeric text-faint px-3 py-3">
                    {r.hashCurrent.slice(0, 10)}…
                  </td>
                  <td className="font-numeric text-muted px-3 py-3">{r.ipAddress ?? '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {openRow && <AuditDrawer row={openRow} onClose={() => setOpenRow(null)} />}
      <VerifyModal result={verifyResult} onClose={() => setVerifyResult(null)} />
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
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        'duration-hover rounded-pill border px-2.5 py-0.5 text-micro font-medium transition-colors ' +
        (on
          ? 'border-accent bg-accent-wash text-accent'
          : 'border-line text-muted hover:bg-canvas hover:text-text')
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
      className="bg-ink/30 fixed inset-0 z-50 flex justify-end"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="border-line bg-panel h-full w-full max-w-lg overflow-y-auto border-l p-5"
        role="dialog"
        aria-modal="true"
        aria-label={actionLabel(row.action)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-ink text-h3 font-semibold">{actionLabel(row.action)}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <dl className="mb-4 flex flex-col gap-1.5 text-caption">
          <Row k="Entity" v={`${row.entityType}, ${row.entityId}`} />
          <Row k="Actor" v={row.actorName ?? row.actorType} />
          <Row k="When" v={formatDateTime(row.timestamp)} />
          <Row k="Hash" v={row.hashCurrent} mono />
          <Row k="Prev hash" v={row.hashPrevious ?? '— (chain root)'} mono />
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
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
    <div className="min-w-0">
      <div className="text-faint mb-1 text-micro font-semibold">{title}</div>
      <pre className="font-numeric border-line bg-canvas overflow-x-auto rounded-sm border p-2 text-micro">
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
      <dt className="text-muted shrink-0">{k}</dt>
      <dd className={'text-text min-w-0 text-right ' + (mono ? 'font-numeric break-all' : '')}>
        {v}
      </dd>
    </div>
  );
}

function VerifyModal({
  result,
  onClose,
}: {
  result: AuditVerifyResult | null;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Dialog open={result !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose>
        <DialogTitle>Chain verification</DialogTitle>
        <DialogDescription className="sr-only">
          Result of recomputing the audit hash chain.
        </DialogDescription>
        {result &&
          (result.verified ? (
            <div className="bg-success-bg text-success mt-3 rounded-lg p-4 text-body-sm font-medium">
              Chain verified across {result.eventsChecked} events. No tampering detected.
            </div>
          ) : (
            <div className="bg-danger-wash text-danger mt-3 rounded-lg p-4 text-body-sm font-medium">
              Chain broken. First break at{' '}
              <span className="font-numeric">{result.firstBreakAt}</span>. Follow the audit
              incident runbook.
            </div>
          ))}
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
