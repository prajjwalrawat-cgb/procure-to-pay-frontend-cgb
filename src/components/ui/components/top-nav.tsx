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
 * A top-level section that opens a dropdown instead of navigating — e.g.
 * "Finance" holding Invoices and Payment runs. The trigger is lit when any of
 * its items is current, and carries the sum of their badges so a queue inside
 * a closed menu is still visible.
 */
export interface TopNavMenu {
  label: string;
  items: TopNavItem[];
}

export type TopNavEntry = TopNavItem | TopNavMenu;

export function isTopNavMenu(entry: TopNavEntry): entry is TopNavMenu {
  return 'items' in entry;
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
  /**
   * The top-level row, in order. A plain item is a tab; a menu is a hover
   * dropdown of related sections.
   */
  primary: TopNavEntry[];
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

  // The drawer has room for everything, so it lists it all: loose tabs first,
  // then each dropdown as a headed group, then the overflow groups.
  const drawerGroups: TopNavGroup[] = [
    { items: primary.filter((e): e is TopNavItem => !isTopNavMenu(e)) },
    ...primary.filter(isTopNavMenu).map((m) => ({ heading: m.label, items: m.items })),
    ...overflow,
  ].filter((g) => g.items.length > 0);
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
          'duration-hover flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-body-sm font-medium transition-colors',
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
              'font-numeric rounded-pill px-1.5 text-micro font-semibold leading-[16px]',
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
      <div className="pf-container flex h-14 items-center gap-3">
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
            className="border-line text-faint hover:border-accent/50 duration-hover mx-auto hidden h-9 w-full max-w-md items-center gap-2 rounded-sm border px-2.5 text-left text-body-sm transition-colors md:flex"
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{searchPlaceholder}</span>
            <kbd className="font-numeric text-faint ml-auto shrink-0 text-micro">⌘K</kbd>
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

          No `overflow-x: auto` here: it also clips on the y axis, which would
          cut every dropdown off at the row's edge. The row wraps instead — the
          grouped menus keep it short enough that it never needs to. */}
      <div className="pf-container hidden items-center gap-1 pb-2 lg:flex">
        <nav aria-label="Sections" className="flex min-w-0 flex-wrap items-center gap-0.5">
          {primary.map((entry) =>
            isTopNavMenu(entry) ? (
              <NavMenu
                key={entry.label}
                menu={entry}
                activeHref={activeHref}
                renderLink={renderLink}
              />
            ) : (
              <React.Fragment key={entry.href}>
                {tab(entry, isActiveHref(entry.href, activeHref))}
              </React.Fragment>
            ),
          )}
        </nav>

        {overflowItems.length > 0 ? (
          <div className="relative shrink-0" data-nav-overflow>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                'rounded-pill duration-hover flex items-center gap-1 px-3 py-1.5 text-body-sm font-medium transition-colors',
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
                      <p className="text-faint px-2 py-1 text-micro">{group.heading}</p>
                    ) : null}
                    {group.items.map((item) => {
                      const active = isActiveHref(item.href, activeHref);
                      return (
                        <div key={item.href} onClick={() => setMenuOpen(false)}>
                          {renderLink(
                            item,
                            <span
                              className={cn(
                                'flex items-center justify-between rounded-sm px-2 py-1.5 text-body-sm',
                                active
                                  ? 'text-accent bg-accent-wash font-medium'
                                  : 'text-text hover:bg-canvas',
                              )}
                            >
                              {item.label}
                              {item.badge ? (
                                <span className="font-numeric text-accent text-micro font-semibold">
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
              {drawerGroups.map((group, gi) => (
                <div key={gi} className="py-1">
                  {group.heading ? (
                    <p className="text-faint px-2 py-1 text-micro">{group.heading}</p>
                  ) : null}
                  {group.items.map((item) => {
                    const active = isActiveHref(item.href, activeHref);
                    return (
                      <div key={item.href} onClick={() => setDrawerOpen(false)}>
                        {renderLink(
                          item,
                          <span
                            className={cn(
                              'flex items-center justify-between rounded-sm px-2.5 py-2 text-body-sm',
                              active
                                ? 'bg-accent font-medium text-white'
                                : 'text-text hover:bg-canvas',
                            )}
                          >
                            {item.label}
                            {item.badge ? (
                              <span
                                className={cn(
                                  'font-numeric text-micro font-semibold',
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

/** How long the pointer may be outside a menu before it closes. Long enough to
 *  cross from trigger to panel, or to overshoot it slightly. */
const HOVER_CLOSE_DELAY_MS = 150;

/**
 * One grouped section in the tab row, opened by hovering.
 *
 * Hover opens only for a mouse — on touch, the tap that would fire the
 * synthetic enter also fires the click, and the two cancel out. Touch and
 * keyboard use the trigger as a toggle instead; Escape closes and hands focus
 * back to the trigger, and tabbing out of the menu closes it.
 */
function NavMenu({
  menu,
  activeHref,
  renderLink,
}: {
  menu: TopNavMenu;
  activeHref: string;
  renderLink: TopNavProps['renderLink'];
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

  const active = menu.items.some((i) => isActiveHref(i.href, activeHref));
  const badge = menu.items.reduce((n, i) => n + (i.badge ?? 0), 0);

  const cancelClose = (): void => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = (): void => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };

  React.useEffect(() => cancelClose, []);

  // Navigating away is what a menu click is for, so a route change closes it.
  React.useEffect(() => {
    setOpen(false);
  }, [activeHref]);

  return (
    <div
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        cancelClose();
        setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') scheduleClose();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'rounded-pill duration-hover flex items-center gap-1 whitespace-nowrap px-3 py-1.5 text-body-sm font-medium transition-colors',
          active ? 'bg-accent text-white' : 'text-muted hover:text-text',
          open && !active && 'text-text',
        )}
      >
        {menu.label}
        {badge > 0 ? (
          <span
            className={cn(
              'font-numeric rounded-pill px-1.5 text-micro font-semibold leading-[16px]',
              active ? 'bg-white/20 text-white' : 'bg-accent-wash text-accent',
            )}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
        <ChevronDown
          className={cn('duration-hover h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {/* The panel sits flush under the trigger and spaces itself with
          padding, not margin: a margin is a dead strip the pointer has to
          cross, and crossing it would count as leaving the menu. */}
      {open ? (
        <div id={menuId} role="menu" className="absolute left-0 top-full z-50 pt-1.5">
          <div className="border-line bg-panel min-w-[13rem] rounded-lg border p-1.5 shadow-lg">
            {menu.items.map((item) => {
              const itemActive = isActiveHref(item.href, activeHref);
              return (
                <div key={item.href} role="none" onClick={() => setOpen(false)}>
                  {renderLink(
                    item,
                    <span
                      role="menuitem"
                      aria-current={itemActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center justify-between gap-4 whitespace-nowrap rounded-sm px-2 py-1.5 text-body-sm',
                        itemActive
                          ? 'text-accent bg-accent-wash font-medium'
                          : 'text-text hover:bg-canvas',
                      )}
                    >
                      {item.label}
                      {item.badge ? (
                        <span className="font-numeric text-accent text-micro font-semibold">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </span>,
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
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
        'duration-hover flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-body-sm font-medium transition-colors',
        active
          ? 'border-accent text-accent'
          : 'text-muted hover:text-text border-transparent',
      )}
    >
      {item.label}
      {typeof item.count === 'number' ? (
        <span className={cn('font-numeric text-micro', active ? 'text-accent' : 'text-faint')}>
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
