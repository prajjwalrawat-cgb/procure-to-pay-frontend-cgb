'use client';

import { useOrganisationSettings, useUploadLogo } from '@/lib/api/settings';
import { useToastStore } from '@/store/toast-store';
import { Panel } from './ui';

/** Letterhead logo — printed at the top of every purchase-order PDF. */
export function BrandingSection(): React.JSX.Element {
  const { data, isLoading } = useOrganisationSettings();
  const upload = useUploadLogo();
  const toast = useToastStore((s) => s.push);

  if (isLoading || !data) {
    return <div className="text-[13px] text-muted">Loading…</div>;
  }

  const onLogo = (file: File): void =>
    upload.mutate(file, {
      onSuccess: () => toast('Logo updated — it prints on new PO PDFs', 'success'),
      onError: (e) =>
        toast(e instanceof Error ? e.message : 'Could not upload the logo', 'error'),
    });

  return (
    <Panel
      title="Letterhead logo"
      hint="PNG or JPEG. Printed beside the organisation name at the top of every purchase-order PDF."
    >
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-40 items-center justify-center rounded-sm border border-line bg-canvas">
          {data.logoUrl ? (
            // Presigned S3 URL — next/image would need the host allow-listed.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.logoUrl}
              alt="Organisation logo"
              className="max-h-14 max-w-36 object-contain"
            />
          ) : (
            <span className="text-[11px] text-faint">No logo</span>
          )}
        </div>
        <label className="cursor-pointer text-[12px] font-medium text-accent-2">
          {upload.isPending ? 'Uploading…' : 'Upload a logo'}
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onLogo(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </Panel>
  );
}
