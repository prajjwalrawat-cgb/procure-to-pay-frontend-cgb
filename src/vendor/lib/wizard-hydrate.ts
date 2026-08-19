/**
 * Rebuilding the onboarding wizard's form state from what the server saved.
 *
 * Deliberately dependency-free — no api-client, no store — so it stays a pure
 * function that can be tested directly.
 */

import type { ExtractedFieldMap } from '@/lib/shared';

export interface WizardState {
  currentStep: number;
  completionPct: number;
  steps: Record<string, { done: boolean; data: Record<string, unknown> }>;
  /** Values auto-filled from an uploaded GST certificate / PAN card, with their
   *  provenance. Written by the API when a statutory document is uploaded. */
  extracted?: ExtractedFieldMap;
}

/** Form state rebuilt from a saved wizard, ready to seed the wizard's inputs. */
export interface HydratedWizard {
  /** Flat text-input values, keyed exactly as the step payloads key them. */
  fields: Record<string, string>;
  isMsme: boolean;
}

/**
 * Values that drive dedicated controls or are sent as fixed payload constants —
 * they must not leak into the flat text-field map.
 */
const NON_FIELD_KEYS = new Set(['documentsConfirmed']);

/**
 * Rebuild the wizard's form state from what the server already has.
 *
 * The wizard used to start from an empty object and never read the saved steps
 * back, so a vendor returning after a refresh — or after days away — saw a
 * progress bar reporting most of the form complete above inputs that were all
 * blank, and would retype everything. The data was never lost; it simply was
 * not being read.
 *
 * Two layers, in this order: values the vendor has already saved win, and
 * anything still blank is filled from what their documents yielded. That
 * ordering is what makes an edit stick — re-seeding an extracted value over a
 * saved one would silently undo the correction the vendor just made.
 */
export function hydrateWizardForm(state: WizardState | null | undefined): HydratedWizard {
  const fields: Record<string, string> = {};
  let isMsme = false;

  for (const step of Object.values(state?.steps ?? {})) {
    for (const [key, value] of Object.entries(step?.data ?? {})) {
      if (key === 'isMsme') {
        isMsme = value === true;
        continue;
      }
      if (NON_FIELD_KEYS.has(key)) continue;
      if (value === null || value === undefined || typeof value === 'boolean') continue;

      if (Array.isArray(value)) {
        // Only tag lists round-trip as text; arrays of objects have no input.
        if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
          fields[key] = value.join(', ');
        }
        continue;
      }
      if (typeof value === 'object') continue;
      fields[key] = String(value);
    }
  }

  for (const [key, extracted] of Object.entries(state?.extracted ?? {})) {
    if (!fields[key]) fields[key] = extracted.value;
  }

  return { fields, isMsme };
}

/** Provenance for one field, or null when the vendor typed it themselves. */
export function fieldProvenance(
  state: WizardState | null | undefined,
  field: string,
): ExtractedFieldMap[string] | null {
  return state?.extracted?.[field] ?? null;
}

/**
 * Fold a freshly-extracted document into the form the vendor is looking at.
 *
 * Two situations look identical in the form and are not the same thing:
 *
 *  - text typed *before* any document arrived. It is a guess, made when there
 *    was nothing to correct, and the document now supersedes it. Keeping it
 *    would defeat the point of asking for the document at all: the vendor's
 *    typo survives and the registry's value is discarded.
 *  - an edit the vendor made *after* a document supplied that field. That is a
 *    correction of a misread, and it wins — re-uploading the same certificate
 *    must not undo it.
 *
 * The difference between them is whether the field already had provenance.
 * Verified values overwrite either way, since they are locked in the UI and
 * cannot have been typed over.
 */
export function applyExtractedFields(
  current: Record<string, string>,
  provenanceBefore: ExtractedFieldMap,
  incoming: ExtractedFieldMap,
): Record<string, string> {
  const next = { ...current };
  for (const [key, field] of Object.entries(incoming)) {
    const value = (next[key] ?? '').trim();
    const previous = provenanceBefore[key];
    const wasCorrected = !!previous && value !== previous.value.trim();
    if (field.verified || value === '' || !wasCorrected) next[key] = field.value;
  }
  return next;
}
