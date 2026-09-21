'use client';

/**
 * The one page-title pattern. Every list and detail screen opens with this, so
 * heading size, breadcrumb behaviour and action placement are decided once
 * instead of drifting across 90 pages.
 *
 * Two rules the props enforce:
 *
 *  - Context goes in `breadcrumbs`, never appended to `description`. The old
 *    dot-joined "Purchase requests / Artbox Solutions" pattern put the section, a
 *    separator and the tenant name into one grey string that read as neither a
 *    sentence nor a path. The organisation is already named in the top nav; on
 *    a sub-page the breadcrumb says where you are.
 *  - `actions` holds at most one primary button. Anything else is secondary —
 *    see button.tsx.
 */

import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  /** One line under the title. Factual — this is not marketing copy. */
  description?: React.ReactNode;
  /** Status text, SLA markers — sits inline after the title. */
  meta?: React.ReactNode;
  /** At most one primary action; the rest secondary. Right-aligned. */
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Renders the title with tabular figures — for document numbers. */
  numeric?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  breadcrumbs,
  numeric,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5">
          <ol className="text-muted flex flex-wrap items-center gap-1 text-caption">
            {breadcrumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="text-faint h-3 w-3 shrink-0" aria-hidden />
                )}
                {c.href ? (
                  <a
                    href={c.href}
                    className="hover:text-accent duration-hover transition-colors"
                  >
                    {c.label}
                  </a>
                ) : (
                  <span className="text-text" aria-current="page">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h1
              className={cn(
                'text-ink text-h1 font-semibold',
                numeric && 'font-numeric',
              )}
            >
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="text-muted mt-1 text-body">{description}</p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
