'use client';

import type { ClauseLibraryInput } from '@/lib/shared';
import { Pill } from '@/components/ui';
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
    <div className="mx-auto max-w-4xl">
      <Link
        href="/contracts"
        className="text-muted hover:text-text mb-3 inline-flex items-center gap-1 text-[13px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Contracts
      </Link>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Clause library
          </h1>
          <p className="text-muted text-[13px]">
            Standard clauses · governed by Legal & Tenant Admin
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="bg-ink flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Add clause
          </button>
        )}
      </div>

      {show && canManage && (
        <div className="border-line bg-panel mb-4 space-y-2 rounded-lg border p-4">
          <select
            className="border-line rounded-md border px-2.5 py-1.5 text-[13px]"
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
            className="border-line block w-full rounded-md border px-2.5 py-1.5 text-[13px]"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="border-line block w-full rounded-md border px-2.5 py-1.5 text-[13px]"
            rows={3}
            placeholder="Clause text"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              className="bg-accent rounded-md px-4 py-1.5 text-[13px] font-medium text-white"
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
              className="border-line text-text hover:bg-canvas rounded-md border px-4 py-1.5 text-[13px] font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data?.map((l) => (
          <div key={l.id} className="border-line bg-panel rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Pill variant="gray">{l.clauseType.replace('_', ' ')}</Pill>
              <span className="text-ink text-[13px] font-medium">{l.title}</span>
              <span className="text-faint text-[11px]">v{l.version}</span>
              {l.isDefault && <Pill variant="success">default</Pill>}
            </div>
            <p className="text-muted mt-1 text-[12px]">{l.contentText}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
