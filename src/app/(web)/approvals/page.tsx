'use client';

import type { ApprovalMatrixView, ApprovalStep, DocumentType } from '@/lib/shared';
import { PERMISSIONS, ROLE_PERMISSIONS, type RoleName } from '@/lib/shared';
import { Button, PageHeader, Pill, Tabs, TabsList, TabsTrigger } from '@/components/ui';
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
import { useSessionStore } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';
import { formatDateTime } from '@/lib/format';
import { roleLabel } from '@/lib/api/users';

/** One tab per document type the approval engine routes, in procure→pay order. */
const TABS: { key: string; label: string; docType: DocumentType }[] = [
  { key: 'requisitions', label: 'Requisitions', docType: 'REQUISITION' },
  { key: 'purchase-orders', label: 'Purchase orders', docType: 'PURCHASE_ORDER' },
  { key: 'invoices', label: 'Invoices', docType: 'INVOICE' },
  { key: 'payment-runs', label: 'Payment runs', docType: 'PAYMENT_RUN' },
  { key: 'awards', label: 'Sourcing awards', docType: 'RFQ_AWARD' },
  { key: 'onboarding', label: 'Vendor onboarding', docType: 'VENDOR_ONBOARDING' },
  { key: 'vendor-changes', label: 'Vendor changes', docType: 'VENDOR_CHANGE' },
  { key: 'contracts', label: 'Contracts', docType: 'CONTRACT' },
  { key: 'amendments', label: 'Contract amendments', docType: 'CONTRACT_AMENDMENT' },
];

/** Roles holding `approval_matrix:write` — admin and finance head. Derived from
 *  the shared grant table so the UI cannot drift from the API guard. */
function useCanEditMatrix(): boolean {
  const roles = useSessionStore((s) => s.user?.roles ?? []);
  return roles.some((r) =>
    (ROLE_PERMISSIONS[r as RoleName] ?? []).includes(PERMISSIONS.APPROVAL_MATRIX_WRITE),
  );
}

export default function ApprovalsPage(): React.JSX.Element {
  const [tab, setTab] = useState('invoices');
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const canEdit = useCanEditMatrix();

  return (
    <div>
      <div className="mb-4">
        <PageHeader
          title="Approval matrix"
          description="Rules are evaluated by priority; the first match routes the document. Editing a rule creates a new version — in-flight documents keep their snapshot."
        />
        {!canEdit && (
          <p className="mt-1 text-caption text-faint">
            Read-only — only an Admin or the Finance Head can add, edit or deactivate
            rules.
          </p>
        )}
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

      <MatrixTab
        key={active?.docType ?? 'INVOICE'}
        docType={active?.docType ?? 'INVOICE'}
        canEdit={canEdit}
      />
    </div>
  );
}

function MatrixTab({
  docType,
  canEdit,
}: {
  docType: DocumentType;
  canEdit: boolean;
}): React.JSX.Element {
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
        <div className="text-body-sm text-muted">
          {data?.items.length ?? 0} active rule
          {(data?.items.length ?? 0) === 1 ? '' : 's'}
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            Add rule
          </Button>
        )}
      </div>

      {isLoading && <div className="text-body-sm text-muted">Loading rules…</div>}

      <div className="flex flex-col gap-3">
        {data?.items.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            canEdit={canEdit}
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
          <div className="text-body-sm text-muted">
            No active rules — documents of this type cannot be submitted for approval
            until one exists.
            {canEdit ? ' Add one to start routing.' : ''}
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
  canEdit,
  onEdit,
  onDuplicate,
  onDeactivate,
  onHistory,
}: {
  rule: ApprovalMatrixView;
  canEdit: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDeactivate: () => void;
  onHistory: () => void;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-panel p-4" data-testid="rule-card">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-body font-semibold text-ink">{rule.name}</span>
            <Pill variant={rule.isActive ? 'success' : 'gray'} dot>
              {rule.isActive ? 'Active' : 'Draft'}
            </Pill>
            <span className="font-numeric text-micro text-faint">
              v{rule.version}, priority {rule.priority}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onDuplicate}>
              Duplicate
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onHistory}>
            History
          </Button>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onDeactivate}>
              Deactivate
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1 text-micro font-semibold text-faint">
          When
        </div>
        <ConditionChips condition={rule.conditions} />
      </div>

      <div>
        <div className="mb-1.5 text-micro font-semibold text-faint">
          Then route to
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {rule.steps.map((s: ApprovalStep) => (
            <span
              key={s.step_no}
              className="flex items-center gap-2 rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-caption"
            >
              <span className="font-numeric flex h-5 w-5 items-center justify-center rounded-full bg-panel text-micro">
                {s.step_no}
              </span>
              <span className="font-medium text-text">{s.name}</span>
              <span className="text-muted">
                {s.scope === 'tenant'
                  ? 'Org-wide'
                  : String(s.scope).charAt(0).toUpperCase() + String(s.scope).slice(1)}
                , {s.sla_hours}h SLA
                {s.escalate_to ? `, escalates to ${roleLabel(s.escalate_to.role)}` : ''}
                {s.parallel_group ? `, parallel group ${s.parallel_group}` : ''}
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
      <div className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-lg">
        <h3 className="text-h3 font-semibold text-ink">Activate “{rule.name}”?</h3>
        <p className="mt-2 text-body-sm text-muted">
          This will affect all future documents matching these conditions. In-flight
          documents keep their snapshot and are not re-routed.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
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
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-h3 font-semibold text-ink">Version history</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {data?.map((v) => (
            <div key={v.id} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="font-numeric text-body-sm font-semibold text-ink">
                  v{v.version}
                </span>
                <Pill variant={v.isActive ? 'success' : 'gray'} dot>
                  {v.isActive ? 'Active' : 'Draft'}
                </Pill>
              </div>
              <div className="mt-1 text-micro text-muted">
                {v.updatedByName ?? 'system'} ,{' '}
                {formatDateTime(v.createdAt)}
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
