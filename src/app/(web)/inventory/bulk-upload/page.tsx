'use client';

import { Button, Pill } from '@/components/ui';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { openAuthedAsset } from '@/lib/api-client';
import {
  useImportBatch,
  useImportBatches,
  useReprocessImport,
  useResolveImportRow,
  useUploadImport,
} from '@/lib/api/inventory';

type ImportType = 'PRODUCT_MASTER' | 'STOCK_LEDGER';

/** Columns the pipeline reads, shown as a mapping preview before upload. */
const EXPECTED_COLUMNS: Record<ImportType, string[]> = {
  PRODUCT_MASTER: [
    'product_name *',
    'category',
    'colour',
    'image_link',
    'unit',
    'opening_stock',
    'damage_qty',
    'location',
    'rack_no',
    'expiry_waranty_date',
    'product_id',
    'sku',
    'remark',
  ],
  STOCK_LEDGER: [
    'product_name *',
    'colour',
    'txn_type *',
    'qty *',
    'location *',
    'date',
    'vendor',
    'rate',
    'tax',
    'qc_status',
    'department',
    'issued_to',
    'platform',
    'order_id',
    'customer_name',
    'remark',
    'source_row_ref',
  ],
};

export default function BulkUploadPage(): React.JSX.Element {
  const [importType, setImportType] = useState<ImportType>('PRODUCT_MASTER');
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [detected, setDetected] = useState<{ sheet: string | null; headerRow: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadImport();
  const batches = useImportBatches();

  async function submit(): Promise<void> {
    if (!file) return;
    setError(null);
    setDetected(null);
    try {
      const res = await upload.mutateAsync({
        file,
        importType,
        sheetName: sheetName.trim() || undefined,
      });
      setBatchId(res.batchId);
      setDetected({ sheet: res.sheetName, headerRow: res.headerRowNumber });
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Bulk upload
          </h1>
          <p className="text-muted text-[13px]">
            Staged, validated import · CSV or XLSX
          </p>
        </div>
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            Stock overview
          </Button>
        </Link>
      </div>

      <div className="border-line bg-panel mb-4 rounded-lg border p-4">
        <div className="mb-3 flex items-center gap-2">
          {(['PRODUCT_MASTER', 'STOCK_LEDGER'] as ImportType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setImportType(t)}
              className={
                'rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors ' +
                (importType === t
                  ? 'border-accent text-ink bg-canvas'
                  : 'border-line text-muted hover:text-ink')
              }
            >
              {t === 'PRODUCT_MASTER' ? 'Product master' : 'Stock ledger'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
          className={
            'flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 transition-colors ' +
            (dragging ? 'border-accent bg-canvas' : 'border-line')
          }
        >
          <span className="text-text text-[13px]">
            {file ? file.name : 'Drop a .csv or .xlsx file here, or click to choose'}
          </span>
          <span className="text-faint mt-1 text-[11px]">
            Rows are staged and validated in the background — nothing posts until it passes.
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xlsm"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className="mt-3">
          <label className="text-muted flex flex-col gap-1 text-[12px] font-medium">
            Worksheet (optional)
            <input
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Leave blank to detect automatically"
              className="border-line bg-panel text-text placeholder:text-faint focus:border-accent rounded-md border px-3 py-1.5 text-[13px] outline-none"
            />
          </label>
          <p className="text-faint mt-1 text-[11px]">
            A workbook usually has several sheets and a title above the real header
            row; both are detected from the columns. Name a sheet here to override.
          </p>
        </div>

        {detected?.sheet && (
          <p className="mt-2 text-[12px] text-emerald-700">
            Read worksheet &ldquo;{detected.sheet}&rdquo; using row {detected.headerRow} as
            the header.
          </p>
        )}

        <details className="mt-3">
          <summary className="text-muted cursor-pointer text-[12px]">
            Column mapping preview ({EXPECTED_COLUMNS[importType].length} recognised
            columns)
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXPECTED_COLUMNS[importType].map((c) => (
              <span
                key={c}
                className="border-line bg-canvas font-numeric text-muted rounded border px-1.5 py-0.5 text-[11px]"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="text-faint mt-2 text-[11px]">
            * required. Header names are matched case- and punctuation-insensitively,
            and common legacy spellings are accepted.
          </p>
        </details>

        {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}

        <div className="mt-3 flex justify-end">
          <Button
            variant="accent"
            size="sm"
            disabled={!file || upload.isPending}
            onClick={() => void submit()}
          >
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>

      {batchId && <BatchProgress batchId={batchId} />}

      <section className="mt-6">
        <h2 className="text-faint mb-2 text-[11px] font-medium uppercase tracking-wide">
          Recent imports
        </h2>
        <div className="border-line bg-panel overflow-x-auto rounded-lg border">
          <table className="w-full text-[13px]">
            <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Rows</th>
                <th className="px-3 py-2 text-right font-medium">OK</th>
                <th className="px-3 py-2 text-right font-medium">Skipped</th>
                <th className="px-3 py-2 text-right font-medium">Errors</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(batches.data?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted px-3 py-8 text-center">
                    No imports yet.
                  </td>
                </tr>
              )}
              {(batches.data?.items ?? []).map((b) => (
                <tr key={b.id} className="border-line hover:bg-canvas/60 border-t">
                  <td className="text-ink px-3 py-2">{b.fileName}</td>
                  <td className="text-muted px-3 py-2 text-[12px]">
                    {b.importType === 'PRODUCT_MASTER' ? 'Products' : 'Ledger'}
                  </td>
                  <td className="px-3 py-2">
                    <Pill variant={batchVariant(b.status)} dot>
                      {batchLabel(b.status)}
                    </Pill>
                  </td>
                  <td className="font-numeric text-text px-3 py-2 text-right">
                    {b.totalRows}
                  </td>
                  <td className="font-numeric px-3 py-2 text-right text-emerald-700">
                    {b.successRows}
                  </td>
                  <td className="font-numeric px-3 py-2 text-right text-amber-700">
                    {b.skippedRows}
                  </td>
                  <td className="font-numeric px-3 py-2 text-right text-red-600">
                    {b.errorRows}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setBatchId(b.id)}
                      className="text-accent-2 text-[12px] font-medium hover:underline"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Live progress + the quarantine queue for one batch. */
function BatchProgress({ batchId }: { batchId: string }): React.JSX.Element {
  const [tab, setTab] = useState<'SKIPPED' | 'ERROR' | null>('SKIPPED');
  const { data } = useImportBatch(batchId, { status: tab });
  const resolve = useResolveImportRow(batchId);
  const reprocess = useReprocessImport(batchId);

  if (!data) return <p className="text-muted text-[13px]">Loading batch…</p>;

  const done = data.totalRows - data.pendingRows;
  const pct = data.totalRows === 0 ? 100 : Math.round((done / data.totalRows) * 100);

  return (
    <div className="border-line bg-panel rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-ink text-[15px] font-semibold">{data.fileName}</h2>
          <p className="font-numeric text-muted text-[12px]">{data.id}</p>
        </div>
        <Pill variant={batchVariant(data.status)} dot>
          {batchLabel(data.status)}
        </Pill>
      </div>

      <div className="bg-canvas mb-2 h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-accent h-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-muted mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <span>
          {done} / {data.totalRows} processed
        </span>
        <span className="text-emerald-700">{data.successRows} created/updated</span>
        <span className="text-amber-700">{data.skippedRows} skipped</span>
        <span className="text-red-600">{data.errorRows} errors</span>
      </div>

      {data.errorMessage && (
        <p className="mb-3 text-[12px] text-red-600">{data.errorMessage}</p>
      )}

      {(data.skippedRows > 0 || data.errorRows > 0) && (
        <>
          <div className="border-line mb-2 flex items-center gap-1 border-b">
            {(['SKIPPED', 'ERROR'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  'border-b-2 px-3 py-1.5 text-[13px] font-medium transition-colors ' +
                  (tab === t
                    ? 'border-accent text-ink'
                    : 'text-muted hover:text-ink border-transparent')
                }
              >
                {t === 'SKIPPED' ? 'Quarantine' : 'Errors'}
                <span className="font-numeric text-faint ml-1.5 text-[11px]">
                  {t === 'SKIPPED' ? data.skippedRows : data.errorRows}
                </span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => void openAuthedAsset(`/inventory/bulk-imports/${batchId}/errors.csv`)}
                className="text-accent-2 text-[12px] font-medium hover:underline"
              >
                Download error CSV
              </button>
              <Button
                variant="ghost"
                size="sm"
                disabled={reprocess.isPending}
                onClick={() => reprocess.mutate(undefined as never)}
              >
                Re-run pending
              </Button>
            </div>
          </div>

          {tab === 'SKIPPED' && (
            <p className="text-faint mb-2 text-[11px]">
              These rows named a product with no catalogue match. They are never
              auto-created — confirm each is a real SKU first.
            </p>
          )}

          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-canvas text-faint sticky top-0 text-left text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  {tab === 'SKIPPED' && <th className="w-40 px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-line border-t">
                    <td className="font-numeric text-muted px-3 py-2">{r.rowNumber}</td>
                    <td className="text-ink px-3 py-2">
                      {String(r.rawData.product_name ?? r.rawData.name ?? '—')}
                    </td>
                    <td className="text-muted px-3 py-2 text-[12px]">
                      {r.errorMessage ?? '—'}
                    </td>
                    {tab === 'SKIPPED' && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={resolve.isPending}
                          onClick={() =>
                            resolve.mutate({ rowId: r.id, action: 'CREATE_PRODUCT' })
                          }
                          className="text-accent-2 text-[12px] font-medium hover:underline"
                        >
                          Create SKU
                        </button>
                        <button
                          type="button"
                          disabled={resolve.isPending}
                          onClick={() =>
                            resolve.mutate({ rowId: r.id, action: 'DISCARD' })
                          }
                          className="text-muted ml-3 text-[12px] hover:underline"
                        >
                          Discard
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted px-3 py-6 text-center">
                      Nothing in this queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function batchLabel(status: string): string {
  return (
    {
      PROCESSING: 'Processing',
      COMPLETED: 'Completed',
      COMPLETED_WITH_ERRORS: 'Completed with issues',
      FAILED: 'Failed',
    }[status] ?? status
  );
}

function batchVariant(
  status: string,
): 'success' | 'danger' | 'warn' | 'info' | 'gray' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'COMPLETED_WITH_ERRORS':
      return 'warn';
    case 'FAILED':
      return 'danger';
    case 'PROCESSING':
      return 'info';
    default:
      return 'gray';
  }
}
