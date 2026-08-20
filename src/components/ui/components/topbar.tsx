'use client';

import { Bell, Command as CommandIcon, Maximize2, Menu, PanelLeft } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface TopbarProps {
  title?: React.ReactNode;
  onToggleSidebar?: () => void;
  /** Opens the off-canvas rail below `lg`. */
  onOpenMobileNav?: () => void;
  onOpenCommand?: () => void;
  onToggleFocus?: () => void;
  onOpenNotifications?: () => void;
  /** Unread notification count; renders a badge on the bell when > 0. */
  notificationCount?: number;
  right?: React.ReactNode;
}

/**
 * The top bar, in the same navy as the rail so the chrome reads as one frame
 * around the ice-coloured work surface.
 *
 * The collapse control and the mobile drawer control are different buttons at
 * different breakpoints — collapsing a rail that is already off-canvas does
 * nothing, so on small screens the hamburger opens the drawer instead.
 *
 * Every control renders only when its handler is supplied. The vendor portal
 * mounts this bar without a command palette, focus mode or notifications, and
 * previously still got the buttons — three controls that did nothing when
 * clicked. A control with no behaviour should not be on screen.
 */
export function Topbar({
  title,
  onToggleSidebar,
  onOpenMobileNav,
  onOpenCommand,
  onToggleFocus,
  onOpenNotifications,
  notificationCount = 0,
  right,
}: TopbarProps): React.JSX.Element {
  const iconBtn =
    'text-on-navy-muted hover:bg-navy-3 hover:text-on-navy duration-hover rounded-sm p-1.5 transition-colors';

  return (
    <header className="bg-navy-2 pf-navy-surface border-navy-3 flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
      {/* Mobile: open drawer. Desktop: collapse the rail. */}
      {onOpenMobileNav && (
        <button
          type="button"
          onClick={onOpenMobileNav}
          className={cn(iconBtn, 'lg:hidden')}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>
      )}
      {onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className={cn(iconBtn, 'hidden lg:block')}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" aria-hidden />
        </button>
      )}

      {title && (
        <div className="tracking-heading text-on-navy truncate text-[14px] font-semibold">
          {title}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        {onOpenCommand && (
          <button
            type="button"
            onClick={onOpenCommand}
            className="border-navy-3 text-on-navy-muted hover:bg-navy-3 hover:text-on-navy duration-hover flex items-center gap-2 rounded-sm border px-2 py-1.5 text-[12px] transition-colors sm:px-2.5"
            aria-label="Open command palette"
          >
            <CommandIcon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Search</span>
            <kbd className="font-numeric hidden text-[10px] opacity-70 sm:inline">⌘K</kbd>
          </button>
        )}

        {onToggleFocus && (
          <button
            type="button"
            onClick={onToggleFocus}
            className={cn(iconBtn, 'hidden sm:block')}
            aria-label="Toggle focus mode"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </button>
        )}

        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className={cn(iconBtn, 'relative')}
            aria-label={
              notificationCount > 0
                ? `Notifications, ${notificationCount} unread`
                : 'Notifications'
            }
          >
            <Bell className="h-4 w-4" aria-hidden />
            {notificationCount > 0 && (
              <span className="bg-gold text-navy absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
        )}

        {right}
      </div>
    </header>
  );
}
