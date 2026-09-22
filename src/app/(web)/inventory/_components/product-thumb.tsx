'use client';

import { useState } from 'react';

/**
 * Google Drive share links (`/file/d/<id>/view`, `?id=<id>`) render as an HTML
 * page, not an image, so putting one straight into <img> shows nothing. Drive's
 * thumbnail endpoint serves the actual bytes for the same file, so rewrite to
 * that. Anything else is passed through untouched.
 */
export function toThumbnailSrc(url: string, width = 200): string {
  const m = /drive\.google\.com\/(?:file\/d\/([\w-]+)|(?:open|uc|thumbnail)\?(?:[^#]*&)?id=([\w-]+))/.exec(
    url,
  );
  const id = m?.[1] ?? m?.[2];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}` : url;
}

/**
 * Product image with a graceful fallback. Private Drive files and dead links
 * still fail to load — those fall back to the placeholder rather than leaving a
 * broken-image icon in the table.
 */
export function ProductThumb({
  url,
  alt,
  size = 32,
}: {
  url: string | null;
  alt: string;
  size?: number;
}): React.JSX.Element {
  // Keyed by src, not a boolean, so a changed URL is retried automatically.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = url ? toThumbnailSrc(url, size * 3) : null;
  const box = 'border-line bg-canvas shrink-0 overflow-hidden rounded border';
  const style = { width: size, height: size };

  if (!src || failedSrc === src) {
    return (
      <span
        style={style}
        className={`${box} text-faint flex items-center justify-center text-micro`}
        title={url ? 'Image could not be loaded' : 'No image'}
      >
        {url ? 'IMG' : ''}
      </span>
    );
  }

  return (
    <span style={style} className={box}>
      {/* Plain <img>: the sources are arbitrary third-party hosts, so there is
          nothing for next/image's optimiser to be configured against. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailedSrc(src)}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
