'use client';

import type { ApprovalMatrixView, ApprovalStep, DocumentType } from '@/lib/shared';
import { Button, Pill, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { useState } from 'react';

import { ConditionChips } from '@/components/approvals/condition-chips';
import {
  RuleBuilderModal,
  type RuleDraft,
} from '@/components/approvals/rule-builder-modal';
import {
  useCreateMatrix,
  useMatrixAction,
  useMatrices,
  useMatrixVersions,
  useUpdateMatrix,
} from '@/lib/api/approvals';
import { useToastStore } from '@/store/toast-store';

const TABS: {
  key: string;
  label: string;
  docType: DocumentType | null;
  slice?: number;
}[] = [
  { key: 'invoices', label: 'Invoices', docType: 'INVOICE' },
  { key: 'payment-runs', label: 'Payment runs', docType: 'PAYMENT_RUN' },
  { key: 'purchase-orders', label: 'Purchase orders', docType: null, slice: 4 },
  { key: 'contracts', label: 'Contracts', docType: null, slice: 9 },
  { key: 'onboarding', label: 'Vendor onboarding', docType: null, slice: 7 },
];

export default function ApprovalsPage(): React.JSX.Element {
  const [tab, setTab] = useState('invoices');
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          Approval matrix
        </h1>
        <p className="text-muted text-[13px]">
          Rules are evaluated by priority; the first match routes the document. Editing a
          rule creates a new version — in-flight documents keep their snapshot.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {active?.docType ? (
        <MatrixTab docType={active.docType} />
      ) : (
        <div className="border-line bg-panel text-muted rounded-lg border border-dashed p-8 text-center text-[13px]">
          Configure when Slice {active?.slice} lands.
        </div>
      )}
    </div>
  );
}

function MatrixTab({ docType }: { docType: DocumentType }): React.JSX.Element {
  const { data, isLoading } = useMatrices(docType);
  const create = useCreateMatrix(docType);
  const update = useUpdateMatrix(docType);
  const action = useMatrixAction(docType);
  const toast = useToastStore((s) => s.push);

  const [editing, setEditing] = useState<ApprovalMatrixView | null | 'new'>(null);
  const [activating, setActivating] = useState<ApprovalMatrixView | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);

  const onSave = (draft: RuleDraft): void => {
    if (editing && editing !== 'new') {
      update.mutate(
        {
          id: editing.id,
          input: {
            name: draft.name,
            priority: draft.priority,
            conditions: draft.conditions,
            steps: draft.steps,
          },
        },
        {
          onSuccess: (created) => {
            toast('New draft version created', 'success');
            setEditing(null);
            setActivating(created);
          },
          onError: (e) => toast((e as Error).message, 'error'),
        },
      );
    } else {
      create.mutate(
        { documentType: docType, ...draft },
        {
          onSuccess: (created) => {
            toast('Rule saved as draft', 'success');
            setEditing(null);
            setActivating(created);
          },
          onError: (e) => toast((e as Error).message, 'error'),
        },
      );
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-muted text-[13px]">
          {data?.items.length ?? 0} active rule
          {(data?.items.length ?? 0) === 1 ? '' : 's'}
        </div>
        <Button variant="accent" size="sm" onClick={() => setEditing('new')}>
          Add rule
        </Button>
      </div>

      {isLoading && <div className="text-muted text-[13px]">Loading rules…</div>}

      <div className="flex flex-col gap-3">
        {data?.items.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onEdit={() => setEditing(rule)}
            onDuplicate={() =>
              action.mutate(
                { id: rule.id, action: 'duplicate' },
                { onSuccess: () => toast('Rule duplicated as draft', 'success') },
              )
            }
            onDeactivate={() =>
              action.mutate(
                { id: rule.id, action: 'deactivate' },
                { onSuccess: () => toast('Rule deactivated', 'info') },
              )
            }
            onHistory={() => setHistoryOf(rule.id)}
          />
        ))}
        {data && data.items.length === 0 && !isLoading && (
          <div className="text-muted text-[13px]">
            No active rules. Add one to start routing.
          </div>
        )}
      </div>

      {editing && (
        <RuleBuilderModal
          docType={docType}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={onSave}
          saving={create.isPending || update.isPending}
        />
      )}

      {activating && (
        <ActivateConfirm
          rule={activating}
          onCancel={() => setActivating(null)}
          onConfirm={() => {
            action.mutate(
              { id: activating.id, action: 'activate' },
              {
                onSuccess: () => {
                  toast('Rule activated', 'success');
                  setActivating(null);
                },
              },
            );
          }}
        />
      )}

      {historyOf && <VersionHistory id={historyOf} onClose={() => setHistoryOf(null)} />}
    </div>
  );
}

function RuleCard({
  rule,
  onEdit,
  onDuplicate,
  onDeactivate,
  onHistory,
}: {
  rule: ApprovalMatrixView;
  onEdit: () => void;
  onDuplicate: () => void;
  onDeactivate: () => void;
  onHistory: () => void;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-4" data-testid="rule-card">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-ink text-[14px] font-semibold">{rule.name}</span>
            <Pill variant={rule.isActive ? 'success' : 'gray'} dot>
              {rule.isActive ? 'Active' : 'Draft'}
            </Pill>
            <span className="text-faint font-numeric text-[11px]">
              v{rule.version} · priority {rule.priority}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button variant="ghost" size="sm" onClick={onHistory}>
            History
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeactivate}>
            Deactivate
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-faint mb-1 text-[10px] font-semibold uppercase tracking-wide">
          When
        </div>
        <ConditionChips condition={rule.conditions} />
      </div>

      <div>
        <div className="text-faint mb-1.5 text-[10px] font-semibold uppercase tracking-wide">
          Then route to
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {rule.steps.map((s: ApprovalStep) => (
            <span
              key={s.step_no}
              className="border-line bg-canvas flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-[12px]"
            >
              <span className="bg-panel font-numeric flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
                {s.step_no}
              </span>
              <span className="text-text font-medium">{s.name}</span>
              <span className="text-muted">
                {s.role} · {s.scope} · {s.sla_hours}h
                {s.escalate_to ? ` · ↑${s.escalate_to.role}` : ''}
                {s.parallel_group ? ` · ∥${s.parallel_group}` : ''}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivateConfirm({
  rule,
  onCancel,
  onConfirm,
}: {
  rule: ApprovalMatrixView;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
      <div className="bg-panel border-line w-full max-w-md rounded-xl border p-5 shadow-lg">
        <h3 className="text-ink text-[15px] font-semibold">Activate “{rule.name}”?</h3>
        <p className="text-muted mt-2 text-[13px]">
          This will affect all future documents matching these conditions. In-flight
          documents keep their snapshot and are not re-routed.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={onConfirm}
            data-testid="confirm-activate"
          >
            Activate
          </Button>
        </div>
      </div>
    </div>
  );
}

function VersionHistory({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}): React.JSX.Element {
  const { data } = useMatrixVersions(id);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="bg-panel border-line h-full w-full max-w-md overflow-y-auto border-l p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-ink text-[15px] font-semibold">Version history</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {data?.map((v) => (
            <div key={v.id} className="border-line rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-ink font-numeric text-[13px] font-semibold">
                  v{v.version}
                </span>
                <Pill variant={v.isActive ? 'success' : 'gray'} dot>
                  {v.isActive ? 'Active' : 'Draft'}
                </Pill>
              </div>
              <div className="text-muted mt-1 text-[11px]">
                {v.updatedByName ?? 'system'} ·{' '}
                {new Date(v.createdAt).toLocaleString('en-IN')}
              </div>
              <div className="mt-2">
                <ConditionChips condition={v.conditions} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
