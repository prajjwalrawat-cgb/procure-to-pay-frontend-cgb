'use client';

import {
  Button,
  Card,
  DateInput,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useBankAccounts, useCreatePaymentRun } from '@/lib/api/payments';
import { useToastStore } from '@/store/toast-store';

/** Today as yyyy-mm-dd in local time — the date picker's value format. */
function today(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function NewPaymentRunPage(): React.JSX.Element {
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data: banks, isLoading, error, refetch } = useBankAccounts();
  const create = useCreatePaymentRun();
  const [cycleDate, setCycleDate] = useState(today);
  const [bankAccountId, setBankAccountId] = useState('');

  const accounts = banks?.items ?? [];
  const selectedBank = bankAccountId || accounts[0]?.id || '';

  const onCreate = (): void => {
    if (!selectedBank) {
      toast('Select a bank account', 'error');
      return;
    }
    create.mutate(
      {
        cycleDate: new Date(`${cycleDate}T00:00:00.000Z`).toISOString(),
        bankAccountId: selectedBank,
      },
      {
        onSuccess: (res) => router.push(`/payment-runs/${res.id}`),
        onError: (e) => toast((e as Error).message, 'error'),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <Link
        href="/payment-runs"
        className="text-muted hover:text-text mb-3 inline-flex items-center gap-1 text-caption"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to payment runs
      </Link>
      <PageHeader
        title="New payment run"
        description="Pick a cycle date and the bank account the file will be drawn on."
      />

      <Card className="gap-4 p-5">
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} compact />
        ) : isLoading ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            compact
            title="No bank accounts set up"
            detail="A payment run is drawn on one of the organisation's bank accounts. Add one in Settings, under Bank accounts."
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/settings">Open settings</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Field label="Cycle date" htmlFor="cycle-date">
              <DateInput
                id="cycle-date"
                value={cycleDate}
                onChange={(e) => setCycleDate(e.target.value)}
              />
            </Field>

            <Field label="Bank account" htmlFor="bank-account">
              <Select
                id="bank-account"
                value={selectedBank}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName} ••••{a.accountNoLast4}, {a.formatKey}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/payment-runs">Cancel</Link>
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={create.isPending || accounts.length === 0 || !cycleDate}
            onClick={onCreate}
          >
            Create draft
          </Button>
        </div>
      </Card>
    </div>
  );
}
