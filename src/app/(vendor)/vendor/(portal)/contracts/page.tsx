'use client';

import {
  Badge,
  PageHeader,
  Pill,
  SortableHead,
  TableState,
  useSort,
} from '@/components/ui';
import type { VendorContractListItem } from '@/lib/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useVendorContracts } from '@/vendor/lib/api/contracts';
import { formatDate, statusLabel, statusVariant } from '@/lib/format';

type SortKey = 'number' | 'title' | 'end' | 'status';

export default function VendorContractsPage(): React.JSX.Element {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useVendorContracts();
  const rows = data ?? [];
  const { sorted, sort, toggle } = useSort<VendorContractListItem, SortKey>(rows, {
    number: (c) => c.number,
    title: (c) => c.title,
    end: (c) => new Date(c.validityEnd),
    status: (c) => c.status,
  });

  return (
    <div>
      <PageHeader title="Contracts" description="Your agreements with this buyer." />

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left">
            <tr>
              <SortableHead label="Contract" sortKey="number" sort={sort} onSort={toggle} />
              <SortableHead label="Title" sortKey="title" sort={sort} onSort={toggle} />
              <SortableHead label="Validity" sortKey="end" sort={sort} onSort={toggle} />
              <SortableHead label="Status" sortKey="status" sort={sort} onSort={toggle} />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={4}
              isLoading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              isEmpty={rows.length === 0}
              empty={{
                title: 'No contracts yet',
                detail: 'Agreements the buyer shares with you appear here for review and counter-signature.',
              }}
            />
            {!isLoading &&
              sorted.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/vendor/contracts/${c.id}`)}
                  className="border-line hover:bg-canvas cursor-pointer border-b last:border-0"
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/vendor/contracts/${c.id}`}
                      className="font-numeric text-ink hover:text-accent font-medium"
                    >
                      {c.number}
                    </Link>
                  </td>
                  <td className="text-text px-3 py-3">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {c.title}
                      {c.requiresCountersign && (
                        <Badge variant="caution">Needs your counter-signature</Badge>
                      )}
                    </span>
                  </td>
                  <td className="font-numeric text-muted px-3 py-3">
                    {formatDate(c.validityStart)} → {formatDate(c.validityEnd)}
                  </td>
                  <td className="px-3 py-3">
                    <Pill variant={statusVariant(c.status)} dot>
                      {statusLabel(c.status)}
                    </Pill>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
