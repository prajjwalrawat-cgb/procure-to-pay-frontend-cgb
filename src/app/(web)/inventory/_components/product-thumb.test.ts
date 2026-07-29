import { describe, expect, it } from 'vitest';

import { toThumbnailSrc } from './product-thumb';

/**
 * The Master Inventory Sheet stores Google Drive share links. Those render an
 * HTML page rather than image bytes, so they must be rewritten to Drive's
 * thumbnail endpoint or the product images never appear.
 */
describe('toThumbnailSrc', () => {
  const ID = '1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUv';

  it('rewrites a /file/d/<id>/view share link', () => {
    expect(toThumbnailSrc(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(
      `https://drive.google.com/thumbnail?id=${ID}&sz=w200`,
    );
  });

  it('rewrites an open?id= link', () => {
    expect(toThumbnailSrc(`https://drive.google.com/open?id=${ID}`)).toBe(
      `https://drive.google.com/thumbnail?id=${ID}&sz=w200`,
    );
  });

  it('rewrites a uc?export=download&id= link', () => {
    expect(toThumbnailSrc(`https://drive.google.com/uc?export=download&id=${ID}`)).toBe(
      `https://drive.google.com/thumbnail?id=${ID}&sz=w200`,
    );
  });

  it('is idempotent on an already-rewritten thumbnail link', () => {
    const once = toThumbnailSrc(`https://drive.google.com/file/d/${ID}/view`);
    expect(toThumbnailSrc(once)).toBe(once);
  });

  it('honours the requested width', () => {
    expect(toThumbnailSrc(`https://drive.google.com/file/d/${ID}/view`, 96)).toBe(
      `https://drive.google.com/thumbnail?id=${ID}&sz=w96`,
    );
  });

  it('passes a direct image URL through untouched', () => {
    const direct = 'https://cdn.example.com/products/mug-white.jpg';
    expect(toThumbnailSrc(direct)).toBe(direct);
  });

  it('passes a non-Drive URL through even if it mentions an id', () => {
    const other = 'https://images.example.com/view?id=abc123';
    expect(toThumbnailSrc(other)).toBe(other);
  });
});
