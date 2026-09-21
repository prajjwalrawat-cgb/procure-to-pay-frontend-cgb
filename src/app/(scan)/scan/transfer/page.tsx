'use client';

import { useState } from 'react';

import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import {
  ProductCard,
  QUEUED_MESSAGE,
  QtyField,
  ResultBanner,
} from '@/components/scan/scan-ui';
import { Button } from '@/components/ui';
import { useResolveBarcode, useScanTransfer } from '@/lib/api/scan';
import type { ScanResolveResponse } from '@/lib/shared';

type Step = 'product' | 'source' | 'dest';

/**
 * Transfer — product, source bin, destination bin, in that order.
 *
 * Three sequential scans rather than one form, for the same reason as putaway:
 * the sequence matches what the operator physically does, and it makes the
 * source/destination mix-up — which would move stock the wrong way and need a
 * correcting ledger entry to undo — much harder to make.
 */
export default function ScanTransferPage(): React.JSX.Element {
  const [step, setStep] = useState<Step>('product');
  const [resolved, setResolved] = useState<ScanResolveResponse | null>(null);
  const [barcodeRaw, setBarcodeRaw] = useState('');
  const [sourceBin, setSourceBin] = useState('');
  const [quantity, setQuantity] = useState('');
  const [banner, setBanner] = useState<{
    tone: 'ok' | 'queued' | 'error';
    message: string;
  } | null>(null);

  const resolve = useResolveBarcode();
  const transfer = useScanTransfer();

  function reset(): void {
    setStep('product');
    setResolved(null);
    setBarcodeRaw('');
    setSourceBin('');
    setQuantity('');
  }

  async function onProductScan(value: string): Promise<void> {
    setBanner(null);
    setBarcodeRaw(value);
    try {
      setResolved(await resolve.mutateAsync(value));
      setStep('source');
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Barcode not recognised.',
      });
    }
  }

  async function onDestScan(destBinBarcodeRaw: string): Promise<void> {
    setBanner(null);
    try {
      const outcome = await transfer.mutateAsync({
        barcodeRaw,
        sourceBinBarcodeRaw: sourceBin,
        destBinBarcodeRaw,
        quantity: Number(quantity),
      });

      if (outcome.queued) {
        setBanner({ tone: 'queued', message: QUEUED_MESSAGE });
      } else {
        setBanner({
          tone: 'ok',
          message: `Moved ${quantity} to ${outcome.data?.destBin.name ?? 'destination'} — ${outcome.data?.sourceStockAfter ?? 0} left in ${outcome.data?.sourceBin.name ?? 'source'}.`,
        });
      }
      reset();
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'The transfer was rejected.',
      });
    }
  }

  return (
    <div className="space-y-4">
      {banner ? <ResultBanner tone={banner.tone} message={banner.message} /> : null}

      {step === 'product' ? (
        <section className="space-y-2 rounded-lg border border-line bg-white p-3">
          <h2 className="text-body font-semibold">1. Scan the product</h2>
          <BarcodeScanner
            label="product barcode"
            onScan={(v) => void onProductScan(v)}
            busy={resolve.isPending}
          />
        </section>
      ) : null}

      {resolved ? (
        <ProductCard resolved={resolved}>
          {step !== 'product' ? (
            <div className="pt-2">
              <QtyField
                value={quantity}
                onChange={setQuantity}
                label="Quantity to move"
              />
            </div>
          ) : null}
        </ProductCard>
      ) : null}

      {step === 'source' ? (
        <section className="space-y-2 rounded-lg border border-line bg-white p-3">
          <h2 className="text-body font-semibold">2. Scan the bin it is leaving</h2>
          <BarcodeScanner
            label="source bin label"
            onScan={(v) => {
              setSourceBin(v);
              setStep('dest');
            }}
            busy={Number(quantity) <= 0}
          />
          {Number(quantity) <= 0 ? (
            <p className="text-body-sm text-muted">Enter a quantity first.</p>
          ) : null}
        </section>
      ) : null}

      {step === 'dest' ? (
        <section className="space-y-2 rounded-lg border border-line bg-white p-3">
          <h2 className="text-body font-semibold">3. Scan the bin it is going to</h2>
          <p className="text-caption text-muted">Leaving: {sourceBin}</p>
          <BarcodeScanner
            label="destination bin label"
            onScan={(v) => void onDestScan(v)}
            busy={transfer.isPending}
          />
        </section>
      ) : null}

      {step !== 'product' ? (
        <Button type="button" variant="default" className="w-full" onClick={reset}>
          Start over
        </Button>
      ) : null}
    </div>
  );
}
