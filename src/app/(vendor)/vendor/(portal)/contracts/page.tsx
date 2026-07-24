'use client';

import { Pill } from '@/components/ui';
import { ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useVendorContracts } from '@/vendor/lib/api/contracts';

const label = (s: string): string => s.replace(/_/g, ' ');
const fmt = (iso: string): string => new Date(iso).toLocaleDateString('en-IN');

export default function VendorContractsPage(): React.JSX.Element {
  const router = useRouter();
  const { data, isLoading } = useVendorContracts();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-[20px] font-semibold tracking-tight">Contracts</h1>
      <p className="mb-4 text-[13px] text-neutral-500">
        Your active agreements with Star Cement Ltd.
      </p>

      {isLoading ? (
        <p className="py-10 text-center text-[13px] text-neutral-500">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-[13px] text-neutral-500">
          <ScrollText className="h-8 w-8 text-neutral-300" />
          No active contracts.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-[13px]">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[12px] text-neutral-500">
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
                  className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                >
                  <td className="px-3 py-2 font-mono font-medium text-emerald-700">
                    {c.number}
                  </td>
                  <td className="px-3 py-2">
                    {c.title}
                    {c.requiresCountersign && <Pill variant="warn">Counter-sign</Pill>}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
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
