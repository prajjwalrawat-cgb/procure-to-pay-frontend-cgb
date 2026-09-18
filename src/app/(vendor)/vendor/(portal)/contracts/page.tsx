'use client';

import { PageHeader, Pill } from '@/components/ui';
import { ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useVendorContracts } from '@/vendor/lib/api/contracts';
import { formatDate } from '@/lib/format';

const label = (s: string): string => s.replace(/_/g, ' ');
const fmt = (iso: string): string => formatDate(iso);

export default function VendorContractsPage(): React.JSX.Element {
  const router = useRouter();
  const { data, isLoading } = useVendorContracts();

  return (
    <div>
      <PageHeader title="Contracts" description="Your active agreements" />

      {isLoading ? (
        <p className="py-10 text-center text-[13px] text-muted">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-[13px] text-muted">
          <ScrollText className="h-8 w-8 text-faint-line" />
          No active contracts.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-line border-b text-left text-[12px] text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Contract</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Validity</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/vendor/contracts/${c.id}`)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas"
                >
                  <td className="px-3 py-2 font-mono font-medium text-success">
                    {c.number}
                  </td>
                  <td className="px-3 py-2">
                    {c.title}
                    {c.requiresCountersign && <Pill variant="warn">Counter-sign</Pill>}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {fmt(c.validityStart)} → {fmt(c.validityEnd)}
                  </td>
                  <td className="px-3 py-2">
                    <Pill variant="info">{label(c.status)}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
