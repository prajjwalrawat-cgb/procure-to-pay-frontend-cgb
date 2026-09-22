'use client';

import type { ClauseLibraryInput } from '@/lib/shared';
import {
  Badge,
  Button,
  DataState,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonCards,
  Textarea,
} from '@/components/ui';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useAddLibraryClause, useClauseLibrary } from '@/lib/api/contracts';
import { humanise } from '@/lib/format';
import { useSessionStore } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';

const MANAGE_ROLES = ['TENANT_ADMIN', 'LEGAL_OFFICER'];
const CLAUSE_TYPES = [
  'PAYMENT_TERMS',
  'DELIVERY_SLA',
  'QUALITY_STANDARD',
  'PENALTY',
  'FORCE_MAJEURE',
  'CONFIDENTIALITY',
  'IP',
  'TERMINATION',
  'LIABILITY',
  'INSURANCE',
  'CUSTOM',
];

export default function ClauseLibraryPage(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useClauseLibrary();
  const add = useAddLibraryClause();
  const push = useToastStore((s) => s.push);
  const roles = useSessionStore((s) => s.user?.roles ?? []);
  const canManage = roles.some((r) => MANAGE_ROLES.includes(r));

  const [show, setShow] = useState(false);
  const [clauseType, setClauseType] = useState('PAYMENT_TERMS');
  const [title, setTitle] = useState('');
  const [contentText, setContentText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const visible = useMemo(
    () => (data ?? []).filter((l) => !typeFilter || l.clauseType === typeFilter),
    [data, typeFilter],
  );

  const submit = async (): Promise<void> => {
    const body: ClauseLibraryInput = {
      clauseType: clauseType as ClauseLibraryInput['clauseType'],
      title,
      contentText,
      isDefault: false,
    };
    try {
      await add.mutateAsync(body);
      push('Clause added to library', 'success');
      setShow(false);
      setTitle('');
      setContentText('');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Contracts', href: '/contracts' }, { label: 'Clause library' }]}
        title="Clause library"
        description="Standard clauses, governed by Legal and Tenant Admin."
        actions={
          canManage && !show ? (
            <Button variant="primary" size="sm" onClick={() => setShow(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add clause
            </Button>
          ) : undefined
        }
      />

      {show && canManage && (
        <div className="mb-4 rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-3 text-h3 font-semibold text-ink">New clause</h2>
          <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <Field label="Type" required>
              <Select value={clauseType} onChange={(e) => setClauseType(e.target.value)}>
                {CLAUSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {humanise(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Clause text" required className="sm:col-span-2">
              <Textarea
                rows={4}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShow(false);
                setTitle('');
                setContentText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={!title.trim() || !contentText.trim() || add.isPending}
            >
              {add.isPending ? 'Saving…' : 'Save clause'}
            </Button>
          </div>
        </div>
      )}

      {(data?.length ?? 0) > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select
            aria-label="Clause type"
            className="w-auto"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {CLAUSE_TYPES.filter((t) => data?.some((l) => l.clauseType === t)).map((t) => (
              <option key={t} value={t}>
                {humanise(t)}
              </option>
            ))}
          </Select>
          <span className="text-caption text-muted">{visible.length} shown</span>
        </div>
      )}

      <DataState
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        isEmpty={visible.length === 0}
        loading={<SkeletonCards count={4} />}
        empty={
          typeFilter
            ? { title: 'No clauses of this type', detail: 'Choose another type or clear the filter.' }
            : {
                title: 'The clause library is empty',
                detail: canManage
                  ? 'Add the standard clauses new contracts should draw from.'
                  : 'Legal or a tenant admin adds the standard clauses here.',
              }
        }
      >
        <div className="flex flex-col gap-2">
          {visible.map((l) => (
            <div key={l.id} className="rounded-lg border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body-sm font-medium text-ink">{l.title}</span>
                <Badge variant="neutral">{humanise(l.clauseType)}</Badge>
                {l.isDefault && <Badge variant="classification">Default</Badge>}
                <span className="font-numeric text-caption text-faint">v{l.version}</span>
              </div>
              <p className="mt-1 text-caption text-muted">{l.contentText}</p>
            </div>
          ))}
        </div>
      </DataState>
    </div>
  );
}
