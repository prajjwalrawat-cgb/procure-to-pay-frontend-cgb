import type { InboxItem } from '@/lib/shared';

/**
 * The inbox's human reference for an item, or null when there isn't one.
 * For document types with no number of their own (vendor onboarding, contract,
 * award) the API falls back to the raw document id — a ULID like
 * `vob_01KZTD…` means nothing to a reader, so it is not shown.
 */
export function displayNumber(item: Pick<InboxItem, 'number' | 'documentId'>): string | null {
  return item.number && item.number !== item.documentId ? item.number : null;
}
