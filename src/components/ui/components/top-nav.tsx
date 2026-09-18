'use client';

import { ChevronDown, Menu, Search, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface TopNavItem {
  label: string;
  href: string;
  /** Pending-count badge — approvals waiting on this user, exceptions, etc. */
  badge?: number;
}

export interface TopNavGroup {
  heading?: string;
  items: TopNavItem[];
}

/**
 * Whether a nav item should read as current.
 *
 * A section owns its subtree, so `/invoices` stays current on
 * `/invoices/inv_4408` and `/invoices/intake`. Exact matching left every detail
 * page with nothing lit, which loses your place in a product with eighteen
 * modules. `/` is matched exactly or Home would be current everywhere.
 */
export function isActiveHref(href: string, current: string): boolean {
  if (href === '/') return current === '/';
  return current === href || current.startsWith(`${href}/`);
}

export interface TopNavProps {
  brand: React.ReactNode;
  /** The sections that get their own tab, in priority order. */
  primary: TopNavItem[];
  /** Everything else, grouped, behind the overflow menu. */
  overflow?: TopNavGroup[];
  overflowLabel?: string;
  activeHref: string;
  /** Render prop so the host app owns routing (Next <Link>). */
  renderLink: (item: TopNavItem, content: React.ReactNode) => React.ReactNode;
  /** Global search. Opens the command palette rather than being a live field. */
  onOpenSearch?: () => void;
  searchPlaceholder?: string;
  /** Right-hand side of the first row — notifications, account. */
  right?: React.ReactNode;
}

/**
 * The top navigation bar.
 *
 * Two rows, and the difference between them is the point:
 *
 *   row 1 — identity and global tools: logo, global search, account. Things
 *           that are true everywhere in the app.
 *   row 2 — the section tabs. Where you are in the product. The current one is
 *           a filled accent pill.
 *
 * Per-screen tab rows (Open / Draft / Closed) are a third level and use
 * <SubNav>, which is deliberately lighter — an accent underline, no fill — so
 * the two nav levels are never mistaken for each other.
 *
 * Why a top bar and not the old rail: with eighteen modules the dark rail was
 * a permanent 240px frame that made every screen look like an admin template
 * and left the actual work surface narrow. Sections that do not earn a tab go
 * in the overflow menu rather than being promoted to a column of icons.
 *
 * Below `lg` the tab row is replaced by a drawer — a row of eight tabs on a
 * 390px phone is a horizontal scroll nobody discovers.
 */
export function TopNav({
  brand,
  primary,
  overflow = [],
  overflowLabel = 'More',
  activeHref,
  renderLink,
  onOpenSearch,
  searchPlaceholder = 'Search orders, invoices, vendors…',
  right,
}: TopNavProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const overflowItems = overflow.flatMap((g) => g.items);
  const overflowActive = overflowItems.some((i) => isActiveHref(i.href, activeHref));

  // Escape and outside-pointer close the overflow menu.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onPointer = (e: PointerEvent): void => {
      if (!(e.target as HTMLElement).closest('[data-nav-overflow]')) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  // The drawer locks the page behind it; otherwise the list scrolls the app.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  const tab = (item: TopNavItem, active: boolean): React.ReactNode =>
    renderLink(
      item,
      <span
        className={cn(
          'duration-hover flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[13px] font-medium transition-colors',
          active
            ? 'bg-accent rounded-pill text-white'
            : 'text-muted hover:text-text rounded-pill',
        )}
        aria-current={active ? 'page' : undefined}
      >
        {item.label}
        {item.badge ? (
          <span
            className={cn(
              'font-numeric rounded-pill px-1.5 text-[11px] font-semibold leading-[16px]',
              active ? 'bg-white/20 text-white' : 'bg-accent-wash text-accent',
            )}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        ) : null}
      </span>,
    );

  return (
    // `relative z-30` is load-bearing, not decoration. The header and <main>
    // are siblings in a flex column and <main> comes second in DOM order, so
    // with both at `z-auto` main paints over the header — and the overflow
    // menu's own `z-50` cannot rescue it, because that only orders children
    // *within* the header. Without this the "More" menu opened invisibly
    // behind the page content.
    <header className="bg-panel border-line relative z-30 shrink-0 border-b">
      {/* Row 1 — identity, global search, account. */}
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="text-muted hover:bg-canvas hover:text-text rounded-sm p-1.5 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex shrink-0 items-center">{brand}</div>

        {onOpenSearch ? (
          <button
            type="button"
            onClick={onOpenSearch}
            className="border-line text-faint hover:border-accent/50 duration-hover mx-auto hidden h-9 w-full max-w-md items-center gap-2 rounded-sm border px-2.5 text-left text-[13px] transition-colors md:flex"
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{searchPlaceholder}</span>
            <kbd className="font-numeric text-faint ml-auto shrink-0 text-[11px]">⌘K</kbd>
          </button>
        ) : (
          <div className="mx-auto" />
        )}

        {onOpenSearch ? (
          <button
            type="button"
            onClick={onOpenSearch}
            className="text-muted hover:bg-canvas hover:text-text ml-auto rounded-sm p-1.5 md:hidden"
            aria-label="Search"
          >
            <Search className="h-4 w-4" aria-hidden />
          </button>
        ) : null}

        <div className={cn('flex items-center gap-1.5', onOpenSearch ? '' : 'ml-auto')}>
          {right}
        </div>
      </div>

      {/* Row 2 — section tabs. Hidden below lg, where the drawer takes over.

          The scroll container is the inner <nav> only. The overflow trigger is
          its sibling, because `overflow-x: auto` also clips on the y axis and
          would cut the open menu off at the row's edge. */}
      <div className="hidden items-center gap-1 px-3 pb-2 sm:px-5 lg:flex">
        <nav
          aria-label="Sections"
          className="pf-scroll-x flex min-w-0 items-center gap-0.5"
        >
          {primary.map((item) => (
            <React.Fragment key={item.href}>
              {tab(item, isActiveHref(item.href, activeHref))}
            </React.Fragment>
          ))}
        </nav>

        {overflowItems.length > 0 ? (
          <div className="relative shrink-0" data-nav-overflow>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                'rounded-pill duration-hover flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium transition-colors',
                overflowActive ? 'bg-accent text-white' : 'text-muted hover:text-text',
              )}
            >
              {overflowLabel}
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="border-line bg-panel absolute right-0 z-50 mt-1.5 w-64 rounded-lg border p-1.5 shadow-lg"
              >
                {overflow.map((group) => (
                  <div key={group.heading ?? 'group'} className="py-0.5">
                    {group.heading ? (
                      <p className="text-faint px-2 py-1 text-[11px]">{group.heading}</p>
                    ) : null}
                    {group.items.map((item) => {
                      const active = isActiveHref(item.href, activeHref);
                      return (
                        <div key={item.href} onClick={() => setMenuOpen(false)}>
                          {renderLink(
                            item,
                            <span
                              className={cn(
                                'flex items-center justify-between rounded-sm px-2 py-1.5 text-[13px]',
                                active
                                  ? 'text-accent bg-accent-wash font-medium'
                                  : 'text-text hover:bg-canvas',
                              )}
                            >
                              {item.label}
                              {item.badge ? (
                                <span className="font-numeric text-accent text-[11px] font-semibold">
                                  {item.badge}
                                </span>
                              ) : null}
                            </span>,
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Mobile drawer — the full section list, since the tab row is hidden. */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/25"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="bg-panel absolute inset-y-0 left-0 flex w-72 flex-col">
            <div className="border-line flex h-14 shrink-0 items-center justify-between border-b px-3">
              {brand}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-muted hover:bg-canvas rounded-sm p-1.5"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <nav aria-label="Sections" className="flex-1 overflow-y-auto p-2">
              {[{ items: primary }, ...overflow].map((group, gi) => (
                <div key={gi} className="py-1">
                  {'heading' in group && group.heading ? (
                    <p className="text-faint px-2 py-1 text-[11px]">{group.heading}</p>
                  ) : null}
                  {group.items.map((item) => {
                    const active = isActiveHref(item.href, activeHref);
                    return (
                      <div key={item.href} onClick={() => setDrawerOpen(false)}>
                        {renderLink(
                          item,
                          <span
                            className={cn(
                              'flex items-center justify-between rounded-sm px-2.5 py-2 text-[13px]',
                              active
                                ? 'bg-accent font-medium text-white'
                                : 'text-text hover:bg-canvas',
                            )}
                          >
                            {item.label}
                            {item.badge ? (
                              <span
                                className={cn(
                                  'font-numeric text-[11px] font-semibold',
                                  active ? 'text-white' : 'text-accent',
                                )}
                              >
                                {item.badge}
                              </span>
                            ) : null}
                          </span>,
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}

// ── Sub-nav ─────────────────────────────────────────────────────────────────

export interface SubNavItem {
  key: string;
  label: string;
  /** Row count for this view. Rendered muted after the label. */
  count?: number;
  href?: string;
  disabled?: boolean;
}

export interface SubNavProps {
  items: SubNavItem[];
  /** The active item's `key`. */
  value: string;
  onChange?: (key: string) => void;
  /** For link-driven sub-navs (e.g. the inventory section). */
  renderLink?: (item: SubNavItem, content: React.ReactNode) => React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

/**
 * The per-screen tab row: Open / Partial / Closed, Stock / Ledger / Locations.
 *
 * Deliberately a different weight from the primary nav pill — accent text with
 * a 2px underline, no fill. Two filled-pill rows stacked would read as one nav
 * with sixteen destinations; this way the level you are on is unambiguous.
 */
export function SubNav({
  items,
  value,
  onChange,
  renderLink,
  className,
  'aria-label': ariaLabel = 'Views',
}: SubNavProps): React.JSX.Element {
  const inner = (item: SubNavItem, active: boolean): React.ReactNode => (
    <span
      className={cn(
        'duration-hover flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
        active
          ? 'border-accent text-accent'
          : 'text-muted hover:text-text border-transparent',
      )}
    >
      {item.label}
      {typeof item.count === 'number' ? (
        <span className={cn('font-numeric text-[11px]', active ? 'text-accent' : 'text-faint')}>
          {item.count}
        </span>
      ) : null}
    </span>
  );

  return (
    <nav
      aria-label={ariaLabel}
      className={cn('border-line pf-scroll-x flex items-center border-b', className)}
    >
      {items.map((item) => {
        const active = item.key === value;
        if (renderLink) {
          return (
            <React.Fragment key={item.key}>{renderLink(item, inner(item, active))}</React.Fragment>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange?.(item.key)}
            className="disabled:opacity-50"
          >
            {inner(item, active)}
          </button>
        );
      })}
    </nav>
  );
}
