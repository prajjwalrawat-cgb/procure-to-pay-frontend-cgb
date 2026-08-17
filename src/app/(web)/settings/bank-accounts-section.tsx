'use client';

import { Button, Input, Pill } from '@/components/ui';
import {
  BANK_FORMAT_KEYS,
  PERMISSIONS,
  type BankAccountInput,
  type BankAccountView,
} from '@/lib/shared';
import { useState } from 'react';

import {
  useAllBankAccounts,
  useCreateBankAccount,
  useSetBankAccountActive,
  useUpdateBankAccount,
} from '@/lib/api/payments';
import { ApiError } from '@/lib/api-error';
import { useHasPermission } from '@/lib/permissions';
import { useToastStore } from '@/store/toast-store';
import { Field, Panel, selectCls } from './ui';

/** What each bank file layout is, in the words of whoever picks it. */
const FORMAT_LABELS: Record<string, string> = {
  NEFT_BULK: 'NEFT bulk (generic)',
  ICICI_CINB: 'ICICI Corporate Internet Banking',
  SBI_CINB: 'SBI Corporate Internet Banking',
};

const EMPTY: BankAccountInput = {
  bankName: '',
  accountNoLast4: '',
  ifsc: '',
  holderName: '',
  formatKey: 'NEFT_BULK',
  dailyLimit: null,
  tenantCode: null,
};

/**
 * Disbursement accounts — the accounts a payment run debits.
 *
 * Owned by finance rather than the admin alone: an AP head maintains the
 * banking without holding rights over the rest of the organisation's settings,
 * which is why this section gates on `bank_account:*` and not `settings:*`.
 *
 * Only the last four digits of the account number are captured. The bank file
 * is built from the format template plus the corporate code, so storing the
 * full number would put a payment credential in the database for no gain.
 */
export function BankAccountsSection(): React.JSX.Element {
  const { data, isLoading } = useAllBankAccounts();
  const create = useCreateBankAccount();
  const update = useUpdateBankAccount();
  const setActive = useSetBankAccountActive();
  const canManage = useHasPermission(PERMISSIONS.BANK_ACCOUNT_MANAGE);
  const toast = useToastStore((s) => s.push);

  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<BankAccountInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isLoading || !data) {
    return <div className="text-[13px] text-muted">Loading…</div>;
  }

  const startEdit = (a: BankAccountView): void => {
    setForm({
      bankName: a.bankName,
      accountNoLast4: a.accountNoLast4,
      ifsc: a.ifsc,
      holderName: a.holderName,
      formatKey: a.formatKey as BankAccountInput['formatKey'],
      dailyLimit: a.dailyLimit,
      tenantCode: a.tenantCode,
    });
    setErrors({});
    setEditing(a.id);
  };

  const onSave = (): void => {
    setErrors({});
    const body: BankAccountInput = {
      ...form,
      bankName: form.bankName.trim(),
      holderName: form.holderName.trim(),
      ifsc: form.ifsc.trim().toUpperCase(),
      dailyLimit: form.dailyLimit?.trim() ? form.dailyLimit.trim() : null,
      tenantCode: form.tenantCode?.trim() ? form.tenantCode.trim() : null,
    };
    const onError = (e: unknown): void => {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast(e instanceof Error ? e.message : 'Could not save the account', 'error');
    };
    const done = (msg: string) => () => {
      toast(msg, 'success');
      setEditing(null);
    };
    if (editing === 'new') {
      create.mutate(body, { onSuccess: done('Bank account added'), onError });
    } else if (editing) {
      update.mutate(
        { id: editing, body },
        { onSuccess: done('Bank account updated'), onError },
      );
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Panel
      title="Bank accounts"
      hint="The accounts a payment run debits. The format decides which bank file layout is generated for submission."
      action={
        canManage && editing === null ? (
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              setForm(EMPTY);
              setErrors({});
              setEditing('new');
            }}
          >
            Add account
          </Button>
        ) : undefined
      }
    >
      {data.items.length === 0 && editing === null && (
        <p className="text-[12px] text-muted">
          No bank accounts yet. A payment run needs one to debit.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {data.items.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-sm border border-line px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-text">{a.bankName}</span>
                <Pill variant="gray">{FORMAT_LABELS[a.formatKey] ?? a.formatKey}</Pill>
                {!a.isActive && <Pill variant="warn">Retired</Pill>}
              </div>
              <div className="font-numeric truncate text-[11px] text-muted">
                ····{a.accountNoLast4} · {a.ifsc} · {a.holderName}
                {a.dailyLimit ? ` · limit ${a.dailyLimit}` : ''}
              </div>
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="text-[12px] text-muted hover:text-text"
                  disabled={setActive.isPending}
                  onClick={() =>
                    setActive.mutate(
                      { id: a.id, isActive: !a.isActive },
                      {
                        onSuccess: () =>
                          toast(
                            a.isActive ? 'Account retired' : 'Account restored',
                            'success',
                          ),
                        onError: (e) =>
                          toast(e instanceof Error ? e.message : 'Failed', 'error'),
                      },
                    )
                  }
                >
                  {a.isActive ? 'Retire' : 'Restore'}
                </button>
                <button
                  type="button"
                  className="text-[12px] font-medium text-accent-2"
                  onClick={() => startEdit(a)}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing !== null && (
        <div className="mt-2 rounded-sm border border-line bg-canvas p-3">
          <div className="mb-2 text-[13px] font-medium text-ink">
            {editing === 'new' ? 'New bank account' : 'Edit bank account'}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Bank name" error={errors.bankName}>
              <Input
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                aria-invalid={!!errors.bankName}
                placeholder="e.g. HDFC Corporate"
              />
            </Field>
            <Field label="Account holder" error={errors.holderName}>
              <Input
                value={form.holderName}
                onChange={(e) => setForm({ ...form, holderName: e.target.value })}
                aria-invalid={!!errors.holderName}
                placeholder="As it appears on the account"
              />
            </Field>
            <Field
              label="Account number — last 4"
              error={errors.accountNoLast4}
              hint="Only the last four digits are stored."
            >
              <Input
                value={form.accountNoLast4}
                onChange={(e) => setForm({ ...form, accountNoLast4: e.target.value })}
                aria-invalid={!!errors.accountNoLast4}
                maxLength={4}
                placeholder="7890"
              />
            </Field>
            <Field label="IFSC" error={errors.ifsc}>
              <Input
                value={form.ifsc}
                onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
                aria-invalid={!!errors.ifsc}
                maxLength={11}
                placeholder="HDFC0001234"
              />
            </Field>
            <Field
              label="Bank file format"
              error={errors.formatKey}
              hint="Must match what your bank accepts for bulk upload."
            >
              <select
                value={form.formatKey}
                onChange={(e) =>
                  setForm({
                    ...form,
                    formatKey: e.target.value as BankAccountInput['formatKey'],
                  })
                }
                className={selectCls}
              >
                {BANK_FORMAT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {FORMAT_LABELS[k] ?? k}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Corporate / tenant code"
              error={errors.tenantCode}
              hint="Optional — some formats embed the bank's code for your company."
            >
              <Input
                value={form.tenantCode ?? ''}
                onChange={(e) => setForm({ ...form, tenantCode: e.target.value })}
                aria-invalid={!!errors.tenantCode}
              />
            </Field>
            <Field
              label="Daily limit"
              error={errors.dailyLimit}
              hint="Optional ceiling on a single run against this account."
            >
              <Input
                value={form.dailyLimit ?? ''}
                onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
                aria-invalid={!!errors.dailyLimit}
                placeholder="e.g. 5000000"
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="accent" disabled={pending} onClick={onSave}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
