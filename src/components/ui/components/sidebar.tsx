'use client';

import type { LucideIcon } from 'lucide-react';
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

export interface SidebarProps {
  brand: React.ReactNode;
  groups: NavGroup[];
  activeHref: string;
  collapsed?: boolean;
  /** Render prop so the host app owns routing (Next <Link>). */
  renderLink: (item: NavItem, content: React.ReactNode) => React.ReactNode;
}

/**
 * Left navigation shell matching the v6 mockup (Master Context §6). The host app
 * supplies the grouped nav items and the link renderer; this component owns only
 * the visual structure.
 */
export function Sidebar({
  brand,
  groups,
  activeHref,
  collapsed = false,
  renderLink,
}: SidebarProps): React.JSX.Element {
  return (
    <aside
      className={cn(
        'border-line bg-panel duration-panel flex h-screen shrink-0 flex-col border-r transition-[width]',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="border-line flex h-14 items-center gap-2 border-b px-4">
        {brand}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group, gi) => (
          <div key={group.heading ?? gi} className="mb-4">
            {group.heading && !collapsed && (
              <div className="text-faint px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide">
                {group.heading}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                const content = (
                  <span
                    className={cn(
                      'duration-hover flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-accent-wash text-accent-2'
                        : 'text-text hover:bg-canvas',
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge ? (
                      <span className="bg-accent ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
                        {item.badge}
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
    </aside>
  );
}
