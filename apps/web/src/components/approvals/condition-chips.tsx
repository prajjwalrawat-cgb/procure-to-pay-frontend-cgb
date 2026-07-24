'use client';

import type { Condition, ConditionOp } from '@procureflow/shared';

const OP_LABELS: Record<ConditionOp, string> = {
  eq: '=',
  ne: '≠',
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  in: 'in',
  nin: 'not in',
  contains: 'contains',
};

function fieldLabel(field: string): string {
  return field.replace(/_/g, ' ').replace(/\./g, ' · ');
}

function valueLabel(value: unknown): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string' && /^\d{5,}$/.test(value)) {
    return `₹${Number(value).toLocaleString('en-IN')}`;
  }
  return String(value);
}

function Leaf({ c }: { c: Condition }): React.JSX.Element {
  return (
    <span className="border-line bg-canvas font-numeric inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px]">
      <span className="text-text font-medium">{fieldLabel(c.field ?? '')}</span>
      <span className="text-muted">{c.op ? OP_LABELS[c.op] : ''}</span>
      <span className="text-ink">{valueLabel(c.value)}</span>
    </span>
  );
}

function Group({
  items,
  joiner,
}: {
  items: Condition[];
  joiner: string;
}): React.JSX.Element {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {items.map((child, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-faint text-[10px] font-semibold uppercase">
              {joiner}
            </span>
          )}
          <ConditionChips condition={child} />
        </span>
      ))}
    </span>
  );
}

/** Human-readable WHEN rendering of a conditions DSL tree (v6 fchip.set). */
export function ConditionChips({
  condition,
}: {
  condition: Condition;
}): React.JSX.Element {
  if (condition.all) return <Group items={condition.all} joiner="and" />;
  if (condition.any) return <Group items={condition.any} joiner="or" />;
  if (condition.none) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-faint text-[10px] font-semibold uppercase">not</span>
        <Group items={condition.none} joiner="or" />
      </span>
    );
  }
  if (condition.field) return <Leaf c={condition} />;
  return <span className="text-muted text-[11px]">Applies to all documents</span>;
}
