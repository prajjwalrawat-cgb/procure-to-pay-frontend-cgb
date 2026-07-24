'use client';

import {
  APPROVAL_FIELDS,
  APPROVER_ROLES,
  SCOPES,
  type ApprovalFieldDef,
  type ApprovalMatrixView,
  type ApprovalStep,
  type Condition,
  type ConditionOp,
  type DocumentType,
  type SimulateResult,
} from '@/lib/shared';
import { Button } from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { simulateRule } from '@/lib/api/approvals';

interface LeafDraft {
  field: string;
  op: ConditionOp;
  value: string;
}

interface StepDraft {
  name: string;
  role: string;
  scope: string;
  slaHours: number;
  escalateRole: string;
  escalateSla: number;
  parallelGroup: string;
}

export interface RuleDraft {
  name: string;
  priority: number;
  conditions: Condition;
  steps: ApprovalStep[];
}

const SAMPLES: { label: string; amount: string }[] = [
  { label: '₹2L invoice (low)', amount: '200000' },
  { label: '₹12L invoice (mid)', amount: '1200000' },
  { label: '₹1.2Cr invoice (high)', amount: '12000000' },
];

export function RuleBuilderModal({
  docType,
  initial,
  onClose,
  onSave,
  saving,
}: {
  docType: DocumentType;
  initial: ApprovalMatrixView | null;
  onClose: () => void;
  onSave: (draft: RuleDraft) => void;
  saving: boolean;
}): React.JSX.Element {
  const fields = APPROVAL_FIELDS[docType] ?? [];
  const [name, setName] = useState(initial?.name ?? '');
  const [priority, setPriority] = useState(initial?.priority ?? 10);
  const [combinator, setCombinator] = useState<'all' | 'any'>(
    initial?.conditions.any ? 'any' : 'all',
  );
  const [leaves, setLeaves] = useState<LeafDraft[]>(() => initialLeaves(initial, fields));
  const [steps, setSteps] = useState<StepDraft[]>(() => initialSteps(initial));
  const [sim, setSim] = useState<SimulateResult | null>(null);
  const [simIndex, setSimIndex] = useState(0);

  const draft = useMemo<RuleDraft>(
    () => buildDraft(name, priority, combinator, leaves, steps),
    [name, priority, combinator, leaves, steps],
  );

  const runSimulate = async (): Promise<void> => {
    const sample = SAMPLES[simIndex];
    if (!sample) return;
    const result = await simulateRule({
      documentType: docType,
      conditions: draft.conditions,
      steps: draft.steps,
      sampleDocument: {
        documentType: docType,
        total_amount: sample.amount,
        net_amount: sample.amount,
        currency: 'INR',
        vendor: { is_msme: false },
      },
    });
    setSim(result);
  };

  const canSave = name.trim().length > 0 && steps.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-6">
      <div className="bg-panel border-line w-full max-w-3xl rounded-xl border shadow-lg">
        <div className="border-line flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-ink text-[15px] font-semibold">
            {initial ? 'Edit rule (new version)' : 'Add rule'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid max-h-[70vh] gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_260px]">
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <label className="flex-1 text-[12px]">
                <span className="text-muted mb-1 block">Rule name</span>
                <input
                  data-testid="rule-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-line w-full rounded-sm border px-2.5 py-1.5 text-[13px] outline-none"
                  placeholder="MD approval above ₹1Cr"
                />
              </label>
              <label className="w-24 text-[12px]">
                <span className="text-muted mb-1 block">Priority</span>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="border-line w-full rounded-sm border px-2.5 py-1.5 text-[13px] outline-none"
                />
              </label>
            </div>

            {/* WHEN */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-ink text-[12px] font-semibold">WHEN</span>
                <select
                  value={combinator}
                  onChange={(e) => setCombinator(e.target.value as 'all' | 'any')}
                  className="border-line rounded-sm border px-1.5 py-0.5 text-[11px]"
                >
                  <option value="all">match ALL (AND)</option>
                  <option value="any">match ANY (OR)</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                {leaves.map((leaf, i) => (
                  <LeafRow
                    key={i}
                    leaf={leaf}
                    fields={fields}
                    onChange={(next) =>
                      setLeaves((ls) => ls.map((l, j) => (j === i ? next : l)))
                    }
                    onRemove={() => setLeaves((ls) => ls.filter((_, j) => j !== i))}
                  />
                ))}
                <button
                  onClick={() =>
                    setLeaves((ls) => [
                      ...ls,
                      { field: fields[0]?.field ?? 'total_amount', op: 'gte', value: '' },
                    ])
                  }
                  className="text-accent-2 flex items-center gap-1 self-start text-[12px]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add condition
                </button>
              </div>
            </section>

            {/* THEN */}
            <section>
              <div className="text-ink mb-2 text-[12px] font-semibold">THEN ROUTE TO</div>
              <div className="flex flex-col gap-2">
                {steps.map((step, i) => (
                  <StepRow
                    key={i}
                    index={i}
                    step={step}
                    onChange={(next) =>
                      setSteps((ss) => ss.map((s, j) => (j === i ? next : s)))
                    }
                    onRemove={() => setSteps((ss) => ss.filter((_, j) => j !== i))}
                  />
                ))}
                <button
                  data-testid="add-step"
                  onClick={() => setSteps((ss) => [...ss, blankStep()])}
                  className="text-accent-2 flex items-center gap-1 self-start text-[12px]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add step
                </button>
              </div>
            </section>
          </div>

          {/* Test with sample */}
          <aside className="border-line bg-canvas rounded-lg border p-3">
            <div className="text-ink mb-2 text-[12px] font-semibold">
              Test with sample
            </div>
            <select
              value={simIndex}
              onChange={(e) => setSimIndex(Number(e.target.value))}
              className="border-line mb-2 w-full rounded-sm border px-2 py-1 text-[12px]"
            >
              {SAMPLES.map((s, i) => (
                <option key={s.label} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button size="sm" variant="default" onClick={() => void runSimulate()}>
              Simulate
            </Button>
            {sim && (
              <div className="mt-3 flex flex-col gap-2" data-testid="sim-result">
                <div
                  className={
                    'rounded-sm px-2 py-1 text-[11px] font-medium ' +
                    (sim.matched
                      ? 'bg-accent-wash text-accent-2'
                      : 'bg-danger-wash text-danger')
                  }
                >
                  {sim.matched ? 'Rule matches' : 'Rule does not match'}
                </div>
                {sim.matched &&
                  sim.chain.map((s) => (
                    <div key={s.stepNo} className="text-[11px]">
                      <span className="text-muted">{s.stepNo}.</span>{' '}
                      <span className="text-text font-medium">{s.name}</span>{' '}
                      <span className="text-ink">
                        → {s.approverName ?? s.skipReason ?? s.unresolvedReason ?? '—'}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </aside>
        </div>

        <div className="border-line flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            disabled={!canSave || saving}
            onClick={() => onSave(draft)}
            data-testid="save-rule"
          >
            Save as draft
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeafRow({
  leaf,
  fields,
  onChange,
  onRemove,
}: {
  leaf: LeafDraft;
  fields: ApprovalFieldDef[];
  onChange: (l: LeafDraft) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const def = fields.find((f) => f.field === leaf.field) ?? fields[0];
  const ops = def?.ops ?? ['eq'];
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={leaf.field}
        onChange={(e) => onChange({ ...leaf, field: e.target.value })}
        className="border-line rounded-sm border px-2 py-1 text-[12px]"
      >
        {fields.map((f) => (
          <option key={f.field} value={f.field}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        value={leaf.op}
        onChange={(e) => onChange({ ...leaf, op: e.target.value as ConditionOp })}
        className="border-line rounded-sm border px-2 py-1 text-[12px]"
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      <input
        value={leaf.value}
        onChange={(e) => onChange({ ...leaf, value: e.target.value })}
        placeholder={def?.type === 'money' ? '10000000' : 'value'}
        className="border-line font-numeric w-32 rounded-sm border px-2 py-1 text-[12px]"
      />
      <button onClick={onRemove} className="text-faint hover:text-danger">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StepRow({
  index,
  step,
  onChange,
  onRemove,
}: {
  index: number;
  step: StepDraft;
  onChange: (s: StepDraft) => void;
  onRemove: () => void;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel flex flex-wrap items-center gap-1.5 rounded-sm border p-2">
      <span className="bg-canvas font-numeric flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
        {index + 1}
      </span>
      <input
        value={step.name}
        onChange={(e) => onChange({ ...step, name: e.target.value })}
        placeholder="Step name"
        className="border-line w-28 rounded-sm border px-2 py-1 text-[12px]"
      />
      <select
        value={step.role}
        onChange={(e) => onChange({ ...step, role: e.target.value })}
        className="border-line rounded-sm border px-1.5 py-1 text-[12px]"
      >
        {APPROVER_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <select
        value={step.scope}
        onChange={(e) => onChange({ ...step, scope: e.target.value })}
        className="border-line rounded-sm border px-1.5 py-1 text-[12px]"
      >
        {SCOPES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={step.slaHours}
        onChange={(e) => onChange({ ...step, slaHours: Number(e.target.value) })}
        className="border-line w-16 rounded-sm border px-1.5 py-1 text-[12px]"
        title="SLA hours"
      />
      <input
        value={step.parallelGroup}
        onChange={(e) => onChange({ ...step, parallelGroup: e.target.value })}
        placeholder="parallel grp"
        className="border-line w-24 rounded-sm border px-1.5 py-1 text-[11px]"
      />
      <button onClick={onRemove} className="text-faint hover:text-danger ml-auto">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── draft <-> DSL ────────────────────────────────────────────────────────────

function blankStep(): StepDraft {
  return {
    name: '',
    role: 'FINANCE_HEAD',
    scope: 'tenant',
    slaHours: 24,
    escalateRole: '',
    escalateSla: 24,
    parallelGroup: '',
  };
}

function initialLeaves(
  initial: ApprovalMatrixView | null,
  fields: ApprovalFieldDef[],
): LeafDraft[] {
  const group = initial?.conditions.all ?? initial?.conditions.any;
  if (group?.length) {
    return group
      .filter((c) => c.field)
      .map((c) => ({
        field: c.field ?? '',
        op: (c.op ?? 'eq') as ConditionOp,
        value: String(c.value ?? ''),
      }));
  }
  if (initial?.conditions.field) {
    return [
      {
        field: initial.conditions.field,
        op: (initial.conditions.op ?? 'eq') as ConditionOp,
        value: String(initial.conditions.value ?? ''),
      },
    ];
  }
  return [{ field: fields[0]?.field ?? 'total_amount', op: 'gte', value: '' }];
}

function initialSteps(initial: ApprovalMatrixView | null): StepDraft[] {
  if (!initial?.steps.length) return [blankStep()];
  return initial.steps.map((s) => ({
    name: s.name,
    role: s.role,
    scope: s.scope,
    slaHours: s.sla_hours,
    escalateRole: s.escalate_to?.role ?? '',
    escalateSla: s.escalate_to?.sla_hours ?? 24,
    parallelGroup: s.parallel_group ?? '',
  }));
}

function buildDraft(
  name: string,
  priority: number,
  combinator: 'all' | 'any',
  leaves: LeafDraft[],
  steps: StepDraft[],
): RuleDraft {
  const leafConditions: Condition[] = leaves
    .filter((l) => l.field)
    .map((l) => ({ field: l.field, op: l.op, value: coerce(l.value) }));
  const conditions: Condition =
    leafConditions.length === 0
      ? {}
      : combinator === 'any'
        ? { any: leafConditions }
        : { all: leafConditions };
  const dslSteps: ApprovalStep[] = steps.map((s, i) => ({
    step_no: i + 1,
    name: s.name || `Step ${i + 1}`,
    role: s.role as ApprovalStep['role'],
    scope: s.scope as ApprovalStep['scope'],
    sla_hours: s.slaHours,
    ...(s.escalateRole
      ? {
          escalate_to: {
            role: s.escalateRole as ApprovalStep['role'],
            sla_hours: s.escalateSla,
          },
        }
      : {}),
    ...(s.parallelGroup ? { parallel_group: s.parallelGroup } : {}),
  }));
  return { name, priority, conditions, steps: dslSteps };
}

function coerce(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
