'use client';

import { Bell, Command as CommandIcon, PanelLeft, Sun } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface TopbarProps {
  title?: React.ReactNode;
  onToggleSidebar?: () => void;
  onOpenCommand?: () => void;
  onToggleFocus?: () => void;
  onOpenNotifications?: () => void;
  /** Unread notification count; renders a badge on the bell when > 0. */
  notificationCount?: number;
  right?: React.ReactNode;
}

/** Top application bar (Master Context §6): sidebar toggle, command trigger,
 *  focus-mode toggle, notifications tray trigger, and user slot. */
export function Topbar({
  title,
  onToggleSidebar,
  onOpenCommand,
  onToggleFocus,
  onOpenNotifications,
  notificationCount = 0,
  right,
}: TopbarProps): React.JSX.Element {
  return (
    <header className="border-line bg-panel flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="text-muted hover:bg-canvas rounded-sm p-1.5"
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
      {title && (
        <div className="tracking-heading text-ink text-[14px] font-semibold">{title}</div>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenCommand}
          className={cn(
            'border-line text-muted hover:bg-canvas flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-[12px]',
          )}
          aria-label="Open command palette"
        >
          <CommandIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="font-numeric text-faint text-[10px]">⌘K</kbd>
        </button>
        <button
          type="button"
          onClick={onToggleFocus}
          className="text-muted hover:bg-canvas rounded-sm p-1.5"
          aria-label="Toggle focus mode"
        >
          <Sun className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onOpenNotifications}
          className="text-muted hover:bg-canvas relative rounded-sm p-1.5"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="bg-danger absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>
        {right}
      </div>
    </header>
  );
}
