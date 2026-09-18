'use client';

import {
  Pill,
  controlClass,
} from '@/components/ui';
import type { ClauseLibraryItem, PoTermInput } from '@/lib/shared';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

/**
 * Terms & conditions picker shared by the spot-buy wizard and the PR → PO
 * conversion screen, so a PO raised from a requisition carries the same clause
 * set — and the same wording — as one raised directly against a quote.
 *
 * Library clauses are copied, not referenced: the text is what gets stored on
 * the PO, so editing the library later never rewrites an order already placed.
 */
export interface DraftTerm {
  key: string;
  clauseType: string;
  title: string;
  contentText: string;
  isFromLibrary: boolean;
  libraryClauseId: string | null;
  selected: boolean;
}

/** Library rows as draft terms, pre-ticking whatever legal marked as default. */
export function seedLibraryTerms(library: ClauseLibraryItem[] | undefined): DraftTerm[] {
  return (library ?? []).map((c) => ({
    key: c.id,
    clauseType: c.clauseType,
    title: c.title,
    contentText: c.contentText,
    isFromLibrary: true,
    libraryClauseId: c.id,
    selected: c.isDefault,
  }));
}

let specialSeq = 0;

export function blankSpecialTerm(): DraftTerm {
  specialSeq += 1;
  return {
    key: `s${specialSeq}`,
    clauseType: 'CUSTOM',
    title: '',
    contentText: '',
    isFromLibrary: false,
    libraryClauseId: null,
    selected: true,
  };
}

/**
 * The payload for PUT /purchase-orders/:id/terms. Half-typed special conditions
 * are dropped rather than sent — the API rejects an empty title or body, which
 * would fail the whole set.
 */
export function toTermInputs(
  libraryTerms: DraftTerm[],
  special: DraftTerm[],
): PoTermInput[] {
  return [
    ...libraryTerms.filter((t) => t.selected),
    ...special.filter((t) => t.title.trim() && t.contentText.trim()),
  ].map((t) => ({
    clauseType: t.clauseType as PoTermInput['clauseType'],
    title: t.title.trim(),
    contentText: t.contentText.trim(),
    isFromLibrary: t.isFromLibrary,
    libraryClauseId: t.libraryClauseId,
  }));
}

// One definition for every text field, select and date input on this page —
// see components/ui/components/input.tsx.
const inputCls = controlClass;

export function PoTermsEditor({
  libraryTerms,
  special,
  onLibraryChange,
  onSpecialChange,
}: {
  libraryTerms: DraftTerm[];
  special: DraftTerm[];
  onLibraryChange: (next: DraftTerm[]) => void;
  onSpecialChange: (next: DraftTerm[]) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Tick the standard conditions to print on the PO. These come from the clause
        library legal maintains; anything specific to this order goes in as a special
        condition below.
      </p>

      {libraryTerms.length === 0 && (
        <p className="text-[12px] text-muted">
          The clause library is empty — add clauses under{' '}
          <Link href="/contracts/clause-library" className="text-accent-2 underline">
            Contracts → Clause library
          </Link>{' '}
          and they will appear here. The PDF falls back to the built-in wording until
          then.
        </p>
      )}

      {libraryTerms.map((t) => (
        <label
          key={t.key}
          className="flex items-start gap-2.5 rounded-md border border-line p-2.5 hover:bg-canvas"
        >
          <input
            type="checkbox"
            checked={t.selected}
            className="mt-0.5"
            onChange={(e) =>
              onLibraryChange(
                libraryTerms.map((x) =>
                  x.key === t.key ? { ...x, selected: e.target.checked } : x,
                ),
              )
            }
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium text-text">{t.title}</span>
              <Pill variant="gray">{t.clauseType.replace(/_/g, ' ')}</Pill>
            </span>
            <span className="block text-[12px] text-muted">{t.contentText}</span>
          </span>
        </label>
      ))}

      <div className="mt-2 rounded-lg border border-line p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-faint">
            Special conditions
          </span>
          <button
            type="button"
            onClick={() => onSpecialChange([...special, blankSpecialTerm()])}
            className="flex items-center gap-1 text-[12px] font-medium text-accent-2"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        {special.length === 0 && (
          <p className="text-[12px] text-muted">None for this order.</p>
        )}
        {special.map((s) => (
          <div key={s.key} className="mb-2 flex items-start gap-2">
            <div className="flex-1">
              <input
                value={s.title}
                onChange={(e) =>
                  onSpecialChange(
                    special.map((x) =>
                      x.key === s.key ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
                placeholder="Condition title"
                className={inputCls}
              />
              <textarea
                value={s.contentText}
                rows={2}
                onChange={(e) =>
                  onSpecialChange(
                    special.map((x) =>
                      x.key === s.key ? { ...x, contentText: e.target.value } : x,
                    ),
                  )
                }
                placeholder="Wording as it should appear on the PO"
                className={inputCls + ' mt-1'}
              />
            </div>
            <button
              type="button"
              aria-label="Remove condition"
              onClick={() => onSpecialChange(special.filter((x) => x.key !== s.key))}
              className="mt-1.5 text-muted hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
