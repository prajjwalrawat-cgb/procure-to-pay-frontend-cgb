'use client';

import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  slice?: number; // if set, route is a ComingInSlice stub
  badge?: number; // pending-count badge (e.g. approvals awaiting this user)
}

export interface NavGroup {
  heading?: string;
  items: NavItem[];
}

/**
 * Whether a nav item should read as current.
 *
 * Exact matching left every detail and sub-page with no active item at all —
 * open `/invoices/inv_4408` or `/invoices/intake` and nothing in the rail was
 * lit, so you lost your place in a product with eighteen modules. A section
 * owns its subtree, so `/invoices` stays current for anything beneath it.
 *
 * `/` is matched exactly, or Home would be current on every page. No nav href
 * is a prefix of another today, so there is no ambiguity to resolve.
 */
function isActiveHref(href: string, current: string): boolean {
  if (href === '/') return current === '/';
  return current === href || current.startsWith(`${href}/`);
}

export interface SidebarProps {
  brand: React.ReactNode;
  groups: NavGroup[];
  activeHref: string;
  collapsed?: boolean;
  /** Render prop so the host app owns routing (Next <Link>). */
  renderLink: (item: NavItem, content: React.ReactNode) => React.ReactNode;
  /** Drives the mobile drawer. Below `lg` the rail is off-canvas. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  footer?: React.ReactNode;
}

/**
 * The navigation rail — the app's institutional chrome.
 *
 * Navy, not white: with this many modules the rail is a permanent frame around
 * the work, and giving it its own ground stops it competing with the data. The
 * active item is marked with a gold seam, which is the one structural (non
 * action) use of gold in the system — it is the "you are here" of a ledger.
 *
 * Below `lg` the rail is off-canvas and opens as a drawer, because a 240px
 * fixed rail on a 390px phone leaves nothing for the tables this app is made of.
 */
export function Sidebar({
  brand,
  groups,
  activeHref,
  collapsed = false,
  renderLink,
  mobileOpen = false,
  onMobileClose,
  footer,
}: SidebarProps): React.JSX.Element {
  // Escape closes the drawer, and the body is locked while it is open so the
  // page behind does not scroll under the overlay.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onMobileClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, onMobileClose]);

  // The nav genuinely overflows on a short window — around 830px of items in
  // 700px of space — so it must scroll. `overscroll-contain` keeps that scroll
  // to itself rather than letting it chain out to the page, or the page's chain
  // into it.
  const nav = (
    <nav
      className="flex-1 overflow-y-auto overscroll-contain px-2 py-3"
      aria-label="Main"
    >
      {groups.map((group, gi) => (
        <div key={group.heading ?? gi} className="mb-4">
          {group.heading && !collapsed && (
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-on-navy-muted/70">
              {group.heading}
            </div>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActiveHref(item.href, activeHref);
              const content = (
                <span
                  className={cn(
                    'relative flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors duration-hover',
                    active
                      ? 'bg-navy-3 text-on-navy'
                      : 'text-on-navy-muted hover:bg-navy-2 hover:text-on-navy',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-gold"
                    />
                  )}
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge ? (
                    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </span>
              );
              return <li key={item.href}>{renderLink(item, content)}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brandBar = (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-navy-3 px-4">
      {brand}
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'pf-navy-surface hidden h-screen shrink-0 flex-col bg-navy transition-[width] duration-panel lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {brandBar}
        {nav}
        {footer && <div className="border-t border-navy-3 p-2">{footer}</div>}
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn('lg:hidden', mobileOpen ? 'block' : 'hidden')}
        aria-hidden={!mobileOpen}
      >
        <div
          className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm"
          onClick={onMobileClose}
        />
        <aside
          className="pf-navy-surface fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col bg-navy shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-navy-3 px-4">
            {brand}
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation"
              className="ml-auto rounded-sm p-1.5 text-on-navy-muted hover:bg-navy-3 hover:text-on-navy"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {nav}
          {footer && <div className="border-t border-navy-3 p-2">{footer}</div>}
        </aside>
      </div>
    </>
  );
}
