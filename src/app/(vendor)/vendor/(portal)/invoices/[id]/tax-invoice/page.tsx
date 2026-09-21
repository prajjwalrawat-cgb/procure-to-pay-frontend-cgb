'use client';

import { PageHeader } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { TaxInvoiceForm } from '@/components/invoices/tax-invoice-form';
import { useAttachTaxInvoice, useMyInvoice } from '@/vendor/lib/api/invoices';

/**
 * The vendor uploads the tax invoice for a proforma they were paid an advance
 * against. It replaces the PI on the same invoice, so the buyer sees one record
 * with the advance already on it rather than a second bill for the same order.
 */
export default function VendorTaxInvoicePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useMyInvoice(id);
  const attach = useAttachTaxInvoice(id);
  const [error, setError] = useState<string | null>(null);
  const back = (): void => router.push('/vendor/invoices');

  if (isLoading || !data) {
    return <div className="p-6 text-body-sm text-muted">Loading invoice…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <button
        type="button"
        onClick={back}
        className="mb-3 inline-flex items-center gap-1 text-caption text-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
      </button>
      <PageHeader
        title="Upload tax invoice"
        description={`For proforma ${data.vendorInvoiceRef} (${data.number}). It replaces the proforma on the same invoice; any advance already paid stays counted.`}
      />
      {data.documentKind !== 'PROFORMA' ? (
        <div className="rounded-lg border border-line bg-panel p-4 text-body-sm text-muted">
          {data.proformaRef
            ? `The tax invoice for proforma ${data.proformaRef} has already been uploaded.`
            : 'This invoice is not a proforma, so there is nothing to replace.'}
        </div>
      ) : (
        <section className="rounded-lg border border-line bg-panel p-4">
          <TaxInvoiceForm
            proformaRef={data.vendorInvoiceRef}
            proformaTotal={data.grossAmount}
            seedLines={data.lines}
            pending={attach.isPending}
            onCancel={back}
            onSubmit={(file, body) => {
              setError(null);
              attach.mutate(
                { file, body },
                {
                  onSuccess: back,
                  onError: (e) =>
                    setError((e as Error).message || 'Could not upload the tax invoice.'),
                },
              );
            }}
          />
          {error && (
            <div className="mt-3 rounded-sm bg-danger-wash px-3 py-2 text-caption text-danger">
              {error}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
