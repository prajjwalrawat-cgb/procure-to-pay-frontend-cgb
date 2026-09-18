'use client';

import type { ContractTab } from '@/lib/shared';
import {
  Badge,
  Button,
  Card,
  CardFooter,
  CardGrid,
  CardHeader,
  CardMeta,
  CardTitle,
  DataState,
  PageHeader,
  StatusText,
  SubNav,
} from '@/components/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useContracts } from '@/lib/api/contracts';
import { formatDate, inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: ContractTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'awaiting_approval', label: 'Awaiting approval' },
  { key: 'expiring_soon', label: 'Expiring soon' },
  { key: 'expired', label: 'Expired' },
  { key: 'terminated', label: 'Terminated' },
];

const TYPE_LABEL: Record<string, string> = {
  RATE_CONTRACT: 'Rate contract',
  FRAMEWORK_AGREEMENT: 'Framework agreement',
  BLANKET_PO: 'Blanket PO',
  SERVICE_AGREEMENT: 'Service agreement',
};

/**
 * Contracts as a card grid.
 *
 * Both patterns were tried against this data. A contract is chosen by
 * comparison — which agreement covers this spend, whose rate card applies,
 * what is still in validity — and the two facts that decide it (committed
 * value and time left to run) need to sit together, which a row spreads across
 * columns five and six. The list is also short by nature: a tenant has tens of
 * contracts, not thousands, so the density argument for a table does not apply
 * the way it does to purchase orders.
 */
export default function ContractsPage(): React.JSX.Element {
  const [tab, setTab] = useState<ContractTab>('active');
  const { data, isLoading, error, refetch } = useContracts(tab);
  const counts = data?.counts;

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Rate contracts, framework agreements and call-offs."
        actions={
          <>
            <Link href="/contracts/clause-library">
              <Button variant="secondary" size="sm">
                Clause library
              </Button>
            </Link>
            <Link href="/contracts/renewals">
              <Button variant="secondary" size="sm">
                Renewal calendar
              </Button>
            </Link>
            <Link href="/contracts/new">
              <Button variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" /> New contract
              </Button>
            </Link>
          </>
        }
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label, count: counts?.[t.key] }))}
        value={tab}
        onChange={(k) => setTab(k as ContractTab)}
      />

      <DataState
        isLoading={isLoading}
        error={error}
        isEmpty={(data?.items.length ?? 0) === 0}
        onRetry={() => void refetch()}
        empty={{
          title: 'No contracts in this view',
          detail:
            'Agreements you sign with suppliers appear here with their rate card, committed value and validity, and can be called off against directly.',
          action: (
            <Link href="/contracts/new">
              <Button variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" /> New contract
              </Button>
            </Link>
          ),
        }}
      >
        <CardGrid>
          {data?.items.map((c) => {
            const expiringSoon = c.daysToExpiry >= 0 && c.daysToExpiry <= 90;
            return (
              <Card key={c.id} interactive>
                <CardHeader
                  badge={
                    <StatusText variant={statusVariant(c.status)}>
                      {statusLabel(c.status)}
                    </StatusText>
                  }
                >
                  <CardTitle>{c.title}</CardTitle>
                  <CardMeta>
                    <span className="font-numeric">{c.number}</span>
                    <span className="text-faint"> — {c.vendor.name}</span>
                  </CardMeta>
                </CardHeader>

                <div className="flex items-end justify-between gap-3 px-4 pb-3">
                  <div className="min-w-0">
                    <p className="text-faint text-[11px]">Committed value</p>
                    <p className="font-numeric text-ink text-[13px] font-medium">
                      {inr(c.totalValueEstimate, 0)}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-faint text-[11px]">Valid to</p>
                    {expiringSoon ? (
                      <StatusText variant="warn" className="text-[13px]">
                        {c.daysToExpiry}d left
                      </StatusText>
                    ) : (
                      <p className="font-numeric text-ink text-[13px] font-medium">
                        {formatDate(c.validityEnd)}
                      </p>
                    )}
                  </div>
                </div>

                <CardFooter
                  action={
                    <Link href={`/contracts/${c.id}`}>
                      <Button variant="secondary" size="sm">
                        Open contract
                      </Button>
                    </Link>
                  }
                >
                  <Badge variant="neutral">
                    {TYPE_LABEL[c.contractType] ?? c.contractType}
                  </Badge>
                </CardFooter>
              </Card>
            );
          })}
        </CardGrid>
      </DataState>
    </div>
  );
}
