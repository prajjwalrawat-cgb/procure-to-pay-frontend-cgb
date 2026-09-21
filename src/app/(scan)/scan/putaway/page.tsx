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
import { useResolveBarcode, useScanPutaway } from '@/lib/api/scan';
import type { ScanResolveResponse } from '@/lib/shared';

/**
 * Putaway — two scans, in order: the product, then the bin it is going into.
 *
 * The two-step is explicit rather than a single form with two fields, because
 * the operator's hands do it in that order: read the box, walk to the rack,
 * read the shelf label. A form that accepts them in any order invites putting
 * the bin code in the product field.
 */
export default function ScanPutawayPage(): React.JSX.Element {
  const [resolved, setResolved] = useState<ScanResolveResponse | null>(null);
  const [barcodeRaw, setBarcodeRaw] = useState('');
  const [quantity, setQuantity] = useState('');
  const [banner, setBanner] = useState<{
    tone: 'ok' | 'queued' | 'error';
    message: string;
  } | null>(null);

  const resolve = useResolveBarcode();
  const putaway = useScanPutaway();

  async function onProductScan(value: string): Promise<void> {
    setBanner(null);
    setBarcodeRaw(value);
    try {
      setResolved(await resolve.mutateAsync(value));
    } catch (err) {
      setResolved(null);
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Barcode not recognised.',
      });
    }
  }

  async function onBinScan(binBarcodeRaw: string): Promise<void> {
    if (!resolved || Number(quantity) <= 0) return;
    setBanner(null);
    try {
      const outcome = await putaway.mutateAsync({
        barcodeRaw,
        binBarcodeRaw,
        quantity: Number(quantity),
      });

      if (outcome.queued) {
        setBanner({ tone: 'queued', message: QUEUED_MESSAGE });
      } else {
        setBanner({
          tone: 'ok',
          message: `Put away to ${outcome.data?.binLocation.name ?? 'bin'} — ${outcome.data?.remainingToPutaway ?? 0} left.`,
        });
      }
      setResolved(null);
      setQuantity('');
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'The putaway was rejected.',
      });
    }
  }

  const awaitingBin = !!resolved && Number(quantity) > 0;

  return (
    <div className="space-y-4">
      {!resolved ? (
        <BarcodeScanner
          label="product barcode"
          onScan={(v) => void onProductScan(v)}
          busy={resolve.isPending}
        />
      ) : null}

      {banner ? <ResultBanner tone={banner.tone} message={banner.message} /> : null}

      {resolved ? (
        <>
          <ProductCard resolved={resolved}>
            <div className="space-y-3 pt-2">
              <QtyField
                value={quantity}
                onChange={setQuantity}
                label="Quantity to put away"
              />
              <Button
                type="button"
                variant="default"
                className="w-full"
                onClick={() => {
                  setResolved(null);
                  setQuantity('');
                }}
              >
                Scan a different product
              </Button>
            </div>
          </ProductCard>

          {awaitingBin ? (
            <section className="space-y-2 rounded-lg border border-line bg-white p-3">
              <h2 className="text-body font-semibold">Now scan the bin</h2>
              <BarcodeScanner
                label="bin label"
                onScan={(v) => void onBinScan(v)}
                busy={putaway.isPending}
              />
            </section>
          ) : (
            <p className="px-1 text-body-sm text-muted">Enter a quantity to continue.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
