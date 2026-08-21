'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui';

/**
 * BarcodeScanner — camera decode with a manual-entry fallback that is always
 * present, never a hidden "advanced" option.
 *
 * The fallback is not a nicety. Warehouse labels get scuffed, frozen, wrapped in
 * shrink film and stuck on curved surfaces; a scanner that can only scan strands
 * the operator at the shelf with no way to record what they are holding. Typing
 * the code is slower, and it is always available.
 *
 * html5-qrcode is loaded dynamically: it touches `navigator.mediaDevices` at
 * import time, which does not exist during server rendering.
 */

interface BarcodeScannerProps {
  /** Called with the decoded (or typed) value. */
  onScan: (value: string) => void;
  /** What is being scanned — "product barcode", "bin label". */
  label: string;
  /** Disables input while the parent is submitting. */
  busy?: boolean;
}

/** The element the camera preview is mounted into. */
const REGION_ID = 'scan-camera-region';

export function BarcodeScanner({
  onScan,
  label,
  busy,
}: BarcodeScannerProps): React.JSX.Element {
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- html5-qrcode has no exported instance type until loaded
  const scannerRef = useRef<any>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
      await scanner.clear();
    } catch {
      // Already stopped — nothing to unwind.
    }
  }, []);

  // Releasing the camera on unmount matters on a handset: a live stream left
  // running keeps the torch/preview on and drains a shift's battery.
  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  async function startCamera(): Promise<void> {
    setCameraError(null);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(REGION_ID, {
        // 1D retail barcodes first — this is a warehouse, not a QR poster.
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;
      setCameraOn(true);

      await scanner.start(
        { facingMode: 'environment' },
        // A wide, short box suits a 1D barcode; a square one makes the operator
        // hunt for an alignment that a linear code does not need.
        { fps: 10, qrbox: { width: 260, height: 140 } },
        (decoded: string) => {
          // One decode per press. Continuous mode re-fires the same barcode many
          // times a second, which would queue a dozen identical scans.
          void stopCamera().then(() => {
            setCameraOn(false);
            onScanRef.current(decoded);
          });
        },
        () => {
          // Per-frame decode misses are the normal case while aiming; ignore.
        },
      );
    } catch (err) {
      setCameraOn(false);
      scannerRef.current = null;
      setCameraError(
        err instanceof Error
          ? `Camera unavailable: ${err.message}. Type the code instead.`
          : 'Camera unavailable. Type the code instead.',
      );
    }
  }

  function submitManual(): void {
    const value = manual.trim();
    if (!value) return;
    setManual('');
    onScan(value);
  }

  return (
    <div className="space-y-3">
      <div
        id={REGION_ID}
        className={
          'overflow-hidden rounded-lg bg-black ' +
          (cameraOn ? 'aspect-[4/3] w-full' : 'hidden')
        }
      />

      <div className="flex gap-2">
        {cameraOn ? (
          <Button
            type="button"
            variant="default"
            className="flex-1"
            onClick={() => {
              void stopCamera().then(() => setCameraOn(false));
            }}
          >
            Stop camera
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1"
            disabled={busy}
            onClick={() => {
              void startCamera();
            }}
          >
            Scan {label}
          </Button>
        )}
      </div>

      {cameraError ? (
        <p className="text-[13px] text-danger" role="alert">
          {cameraError}
        </p>
      ) : null}

      {/* Always visible — see the component note on damaged labels. */}
      <div className="space-y-1">
        <label className="block text-[12px] text-muted" htmlFor="scan-manual-entry">
          Or type the {label}
        </label>
        <div className="flex gap-2">
          <input
            id="scan-manual-entry"
            className="min-w-0 flex-1 rounded-md border border-line px-3 py-3 text-[16px] outline-none focus:border-accent"
            // 16px and inputMode keep iOS from zooming the viewport on focus,
            // which otherwise leaves the operator scrolled sideways mid-scan.
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={manual}
            disabled={busy}
            placeholder="e.g. 8901234567890"
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitManual();
              }
            }}
          />
          <Button
            type="button"
            variant="default"
            disabled={busy || !manual.trim()}
            onClick={submitManual}
          >
            Enter
          </Button>
        </div>
      </div>
    </div>
  );
}
