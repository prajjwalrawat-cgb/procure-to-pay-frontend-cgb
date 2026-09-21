'use client';

import type { ClauseLibraryInput } from '@/lib/shared';
import {
  PageHeader,
  Pill,
  controlClass,
} from '@/components/ui';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useAddLibraryClause, useClauseLibrary } from '@/lib/api/contracts';
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
  const { data } = useClauseLibrary();
  const add = useAddLibraryClause();
  const push = useToastStore((s) => s.push);
  const roles = useSessionStore((s) => s.user?.roles ?? []);
  const canManage = roles.some((r) => MANAGE_ROLES.includes(r));

  const [show, setShow] = useState(false);
  const [clauseType, setClauseType] = useState('PAYMENT_TERMS');
  const [title, setTitle] = useState('');
  const [contentText, setContentText] = useState('');

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
      <Link
        href="/contracts"
        className="mb-3 inline-flex items-center gap-1 text-body-sm text-muted hover:text-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Contracts
      </Link>
      <PageHeader
        title="Clause library"
        description="Standard clauses, governed by Legal and Tenant Admin."
        actions={
          <>
            {canManage && (
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-body-sm font-medium text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Add clause
              </button>
            )}
          </>
        }
      />

      {show && canManage && (
        <div className="mb-4 space-y-2 rounded-lg border border-line bg-panel p-4">
          <select
            className={controlClass}
            value={clauseType}
            onChange={(e) => setClauseType(e.target.value)}
          >
            {CLAUSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
          <input
            className="block w-full rounded-md border border-line px-2.5 py-1.5 text-body-sm"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="block w-full rounded-md border border-line px-2.5 py-1.5 text-body-sm"
            rows={3}
            placeholder="Clause text"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              className="rounded-md bg-accent px-4 py-1.5 text-body-sm font-medium text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShow(false);
                setTitle('');
                setContentText('');
              }}
              className="rounded-md border border-line px-4 py-1.5 text-body-sm font-medium text-text hover:bg-canvas"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data?.map((l) => (
          <div key={l.id} className="rounded-lg border border-line bg-panel p-4">
            <div className="flex items-center gap-2">
              <Pill variant="gray">{l.clauseType.replace('_', ' ')}</Pill>
              <span className="text-body-sm font-medium text-ink">{l.title}</span>
              <span className="text-micro text-faint">v{l.version}</span>
              {l.isDefault && <Pill variant="success">default</Pill>}
            </div>
            <p className="mt-1 text-caption text-muted">{l.contentText}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
