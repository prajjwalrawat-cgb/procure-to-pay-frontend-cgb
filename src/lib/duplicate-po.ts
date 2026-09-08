import type { PoDuplicateRef } from '@/lib/shared';

import { ApiError } from './api-error';

/** The problem+json type the duplicate guard answers with. */
const DUPLICATE_PO_ERROR_TYPE = 'https://procureflow.io/errors/purchase-order-duplicate';

/** Said in the dialog if the server sent no window of its own. */
const FALLBACK_WINDOW_DAYS = 7;

export interface DuplicatePoMatch {
  duplicates: PoDuplicateRef[];
  /**
   * How far back the server looked. Carried from the error rather than repeated
   * here, so tuning `DUPLICATE_WINDOW_DAYS` on the API cannot leave the dialog
   * quoting a window nobody uses any more.
   */
  windowDays: number;
}

/**
 * The orders a rejected create collided with, or null when the failure was
 * something else.
 *
 * The guard is a warn-and-confirm, not a hard stop: a create that comes back
 * with this is not an error to toast at the buyer but a question to put to
 * them, so it has to be told apart from a real failure before anything is said.
 */
export function duplicatePosFromError(error: unknown): DuplicatePoMatch | null {
  if (!(error instanceof ApiError) || error.type !== DUPLICATE_PO_ERROR_TYPE) return null;
  const { duplicates, windowDays } = error.context as {
    duplicates?: unknown;
    windowDays?: unknown;
  };
  if (!Array.isArray(duplicates) || duplicates.length === 0) return null;
  return {
    duplicates: duplicates as PoDuplicateRef[],
    windowDays: typeof windowDays === 'number' ? windowDays : FALLBACK_WINDOW_DAYS,
  };
}
