'use client';

import {
  useOrganisationSettings,
  useUploadLogo,
  useUploadSignature,
} from '@/lib/api/settings';
import { useToastStore } from '@/store/toast-store';
import { Panel } from './ui';

/** One uploaded branding image: its preview, and the picker that replaces it. */
function ImageUpload({
  url,
  alt,
  emptyLabel,
  actionLabel,
  isPending,
  onPick,
}: {
  url: string | null;
  alt: string;
  emptyLabel: string;
  actionLabel: string;
  isPending: boolean;
  onPick: (file: File) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-40 items-center justify-center rounded-sm border border-line bg-canvas">
        {url ? (
          // Presigned S3 URL — next/image would need the host allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} className="max-h-14 max-w-36 object-contain" />
        ) : (
          <span className="text-[11px] text-faint">{emptyLabel}</span>
        )}
      </div>
      <label className="cursor-pointer text-[12px] font-medium text-accent-2">
        {isPending ? 'Uploading…' : actionLabel}
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          disabled={isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

/** Letterhead logo and authorised signature — both print on the PO PDF. */
export function BrandingSection(): React.JSX.Element {
  const { data, isLoading } = useOrganisationSettings();
  const uploadLogo = useUploadLogo();
  const uploadSignature = useUploadSignature();
  const toast = useToastStore((s) => s.push);

  if (isLoading || !data) {
    return <div className="text-[13px] text-muted">Loading…</div>;
  }

  const onLogo = (file: File): void =>
    uploadLogo.mutate(file, {
      onSuccess: () => toast('Logo updated — it prints on new PO PDFs', 'success'),
      onError: (e) =>
        toast(e instanceof Error ? e.message : 'Could not upload the logo', 'error'),
    });

  const onSignature = (file: File): void =>
    uploadSignature.mutate(file, {
      onSuccess: () => toast('Signature updated — it prints on new PO PDFs', 'success'),
      onError: (e) =>
        toast(e instanceof Error ? e.message : 'Could not upload the signature', 'error'),
    });

  return (
    // Panel carries its own bottom margin, so the two stack without a wrapper.
    <>
      <Panel
        title="Letterhead logo"
        hint="PNG or JPEG. Printed beside the organisation name at the top of every purchase-order PDF."
      >
        <ImageUpload
          url={data.logoUrl}
          alt="Organisation logo"
          emptyLabel="No logo"
          actionLabel="Upload a logo"
          isPending={uploadLogo.isPending}
          onPick={onLogo}
        />
      </Panel>

      <Panel
        title="Authorised signature"
        hint="PNG or JPEG — a transparent PNG sits best. Printed above the “Authorised signatory” line at the foot of every purchase-order PDF, including re-downloads of orders already issued."
      >
        <ImageUpload
          url={data.signatureUrl}
          alt="Authorised signature"
          emptyLabel="No signature"
          actionLabel="Upload a signature"
          isPending={uploadSignature.isPending}
          onPick={onSignature}
        />
      </Panel>
    </>
  );
}
