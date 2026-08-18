'use client';

/**
 * The one page-title pattern. Every list and detail screen opens with this, so
 * heading size, the display face, breadcrumb behaviour and action placement are
 * decided once instead of drifting across 86 pages.
 *
 * The display (serif) face appears here and in KpiCard, and nowhere else — it
 * is authoritative at 20px+ and dated in a table, so the gate is structural.
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
  /** One line under the title. Keep it factual — this is not marketing copy. */
  description?: React.ReactNode;
  /** Status pills, sandbox chips, SLA markers — sits inline after the title. */
  meta?: React.ReactNode;
  /** Primary/secondary actions, right-aligned on desktop, wrapped on mobile. */
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Renders the title in the mono face — for document numbers like PO-2026-0041. */
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
    <header className={cn('mb-5', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5">
          <ol className="text-faint flex flex-wrap items-center gap-1 text-[11px]">
            {breadcrumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
                {c.href ? (
                  <a
                    href={c.href}
                    className="hover:text-ink duration-hover transition-colors"
                  >
                    {c.label}
                  </a>
                ) : (
                  <span aria-current="page">{c.label}</span>
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
                'text-ink text-[20px] leading-tight sm:text-[22px]',
                numeric
                  ? 'font-numeric font-semibold'
                  : 'font-display tracking-display',
              )}
            >
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="text-muted mt-1 text-[13px] leading-relaxed">{description}</p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
