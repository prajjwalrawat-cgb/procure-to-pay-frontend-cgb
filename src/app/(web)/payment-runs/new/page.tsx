'use client';

import { Button, PageHeader } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useBankAccounts, useCreatePaymentRun } from '@/lib/api/payments';
import { useToastStore } from '@/store/toast-store';

export default function NewPaymentRunPage(): React.JSX.Element {
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data: banks } = useBankAccounts();
  const create = useCreatePaymentRun();
  const [cycleDate, setCycleDate] = useState('2026-06-14');
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
    <div className="mx-auto max-w-xl">
      <Link
        href="/payment-runs"
        className="text-muted mb-3 inline-flex items-center gap-1 text-[12px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to payment runs
      </Link>
      <PageHeader
        title="New payment run"
        description="Pick a cycle date and the bank account the file will be drawn on."
      />

      <div className="border-line bg-panel flex flex-col gap-4 rounded-lg border p-5">
        <label className="flex flex-col gap-1">
          <span className="text-muted text-[12px] font-medium">Cycle date</span>
          <input
            type="date"
            value={cycleDate}
            aria-label="Cycle date"
            onChange={(e) => setCycleDate(e.target.value)}
            className="border-line bg-panel rounded-sm border px-3 py-2 text-[13px] outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-muted text-[12px] font-medium">Bank account</span>
          <select
            value={selectedBank}
            aria-label="Bank account"
            onChange={(e) => setBankAccountId(e.target.value)}
            className="border-line bg-panel rounded-sm border px-3 py-2 text-[13px] outline-none"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} · ····{a.accountNoLast4} · {a.formatKey}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <Link href="/payment-runs">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>
          <Button
            variant="accent"
            size="sm"
            disabled={create.isPending || accounts.length === 0}
            onClick={onCreate}
          >
            Create draft
          </Button>
        </div>
      </div>
    </div>
  );
}
