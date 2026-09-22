'use client';

import {
  Button,
  PageHeader,
  Pill,
  Skeleton,
  SubNav,
  TableState,
  controlClass,
} from '@/components/ui';
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
    // Slice 13 — the pack's EAN/UPC. Also accepted as ean / upc / gtin / bar_code.
    // Re-uploading the sheet with this column filled is how a whole catalogue
    // becomes scannable; a blank cell leaves an existing barcode untouched.
    'barcode',
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
  const [detected, setDetected] = useState<{
    sheet: string | null;
    headerRow: number;
  } | null>(null);
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
    <div>
      <PageHeader
        title="Bulk upload"
        description="Staged, validated import from a CSV or XLSX sheet."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/inventory">Stock overview</Link>
          </Button>
        }
      />

      <div className="mb-4 rounded-lg border border-line bg-panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="What the sheet contains">
          {(['PRODUCT_MASTER', 'STOCK_LEDGER'] as ImportType[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={importType === t}
              onClick={() => setImportType(t)}
              className={
                'rounded-md border px-3 py-1.5 text-body-sm font-medium transition-colors ' +
                (importType === t
                  ? 'border-accent bg-accent-wash text-accent'
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
          <span className="text-body-sm text-text">
            {file ? file.name : 'Drop a .csv or .xlsx file here, or click to choose'}
          </span>
          <span className="mt-1 text-caption text-muted">
            Rows are staged and validated in the background — nothing posts until it
            passes.
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
          <label className="flex flex-col gap-1 text-caption font-medium text-muted">
            Worksheet (optional)
            <input
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Leave blank to detect automatically"
              className={controlClass}
            />
          </label>
          <p className="mt-1 text-caption text-muted">
            A workbook usually has several sheets and a title above the real header row;
            both are detected from the columns. Name a sheet here to override.
          </p>
        </div>

        {detected?.sheet && (
          <p className="mt-2 text-caption text-success">
            Read worksheet &ldquo;{detected.sheet}&rdquo; using row {detected.headerRow}{' '}
            as the header.
          </p>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-caption text-muted">
            Column mapping preview ({EXPECTED_COLUMNS[importType].length} recognised
            columns)
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXPECTED_COLUMNS[importType].map((c) => (
              <span
                key={c}
                className="font-numeric rounded border border-line bg-canvas px-1.5 py-0.5 text-micro text-muted"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-2 text-caption text-muted">
            * required. Header names are matched case- and punctuation-insensitively, and
            common legacy spellings are accepted.
          </p>
        </details>

        {error && <p className="mt-3 text-caption text-danger">{error}</p>}

        <div className="mt-3 flex justify-end">
          <Button
            variant="primary"
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
        <h2 className="mb-3 text-h3 font-semibold text-ink">
          Recent imports
        </h2>
        <div className="overflow-x-auto">
          <table className="pf-stack w-full text-body-sm">
            <thead className="border-line border-b text-left text-caption text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">File</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Rows</th>
                <th className="px-3 py-2.5 text-right font-medium">OK</th>
                <th className="px-3 py-2.5 text-right font-medium">Skipped</th>
                <th className="px-3 py-2.5 text-right font-medium">Errors</th>
                <th className="w-20 px-3 py-2.5 text-right font-medium">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <TableState
                colSpan={8}
                skeletonRows={3}
                isLoading={batches.isLoading}
                error={batches.error}
                onRetry={() => void batches.refetch()}
                isEmpty={(batches.data?.items ?? []).length === 0}
                empty={{
                  title: 'No imports yet',
                  detail: 'Upload a product master or stock ledger sheet above to start.',
                }}
              />
              {(batches.data?.items ?? []).map((b) => (
                <tr key={b.id} className="border-t border-line hover:bg-canvas/60">
                  <td className="px-3 py-3.5 text-ink">{b.fileName}</td>
                  <td className="px-3 py-3.5 text-caption text-muted">
                    {b.importType === 'PRODUCT_MASTER' ? 'Products' : 'Ledger'}
                  </td>
                  <td className="px-3 py-3.5">
                    <Pill variant={batchVariant(b.status)} dot>
                      {batchLabel(b.status)}
                    </Pill>
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-right text-text">
                    {b.totalRows}
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-right text-success">
                    {b.successRows}
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-right text-warn">
                    {b.skippedRows}
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-right text-danger">
                    {b.errorRows}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <Button type="button" variant="link" size="sm" onClick={() => setBatchId(b.id)}>
                      View
                    </Button>
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

  if (!data)
    return (
      <div aria-busy="true" className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-3.5 w-64" />
      </div>
    );

  const done = data.totalRows - data.pendingRows;
  const pct = data.totalRows === 0 ? 100 : Math.round((done / data.totalRows) * 100);

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-h3 font-semibold text-ink">{data.fileName}</h2>
          <p className="font-numeric text-caption text-muted">{data.id}</p>
        </div>
        <Pill variant={batchVariant(data.status)} dot>
          {batchLabel(data.status)}
        </Pill>
      </div>

      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-canvas">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
        <span>
          {done} / {data.totalRows} processed
        </span>
        <span className="text-success">{data.successRows} created/updated</span>
        <span className="text-warn">{data.skippedRows} skipped</span>
        <span className="text-danger">{data.errorRows} errors</span>
      </div>

      {data.errorMessage && (
        <p className="mb-3 text-caption text-danger">{data.errorMessage}</p>
      )}

      {(data.skippedRows > 0 || data.errorRows > 0) && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <SubNav
              className="border-b-0"
              items={[
                { key: 'SKIPPED', label: 'Quarantine', count: data.skippedRows },
                { key: 'ERROR', label: 'Errors', count: data.errorRows },
              ]}
              value={tab ?? 'SKIPPED'}
              onChange={(k) => setTab(k as 'SKIPPED' | 'ERROR')}
            />
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  void openAuthedAsset(`/inventory/bulk-imports/${batchId}/errors.csv`)
                }
              >
                Download error CSV
              </Button>
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
            <p className="mb-2 text-caption text-muted">
              These rows named a product with no catalogue match. They are never
              auto-created — confirm each is a real SKU first.
            </p>
          )}

          <div className="max-h-80 overflow-y-auto">
            <table className="pf-stack w-full text-body-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel text-left text-caption text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Row</th>
                  <th className="px-3 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium">Reason</th>
                  {tab === 'SKIPPED' && (
                    <th className="w-40 px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Resolve</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="font-numeric px-3 py-3.5 text-muted">{r.rowNumber}</td>
                    <td className="px-3 py-3.5 text-ink">
                      {String(r.rawData.product_name ?? r.rawData.name ?? '—')}
                    </td>
                    <td className="px-3 py-3.5 text-caption text-muted">
                      {r.errorMessage ?? '—'}
                    </td>
                    {tab === 'SKIPPED' && (
                      <td className="px-3 py-3.5 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={resolve.isPending}
                            onClick={() =>
                              resolve.mutate({ rowId: r.id, action: 'CREATE_PRODUCT' })
                            }
                          >
                            Create SKU
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={resolve.isPending}
                            onClick={() => resolve.mutate({ rowId: r.id, action: 'DISCARD' })}
                          >
                            Discard
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted">
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

function batchVariant(status: string): 'success' | 'danger' | 'warn' | 'info' | 'neutral' {
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
      return 'neutral';
  }
}
