'use client';

import { Sparkles } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Dialog, DialogContent, DialogTitle } from './dialog';

export interface CommandRoute {
  label: string;
  href: string;
  keywords?: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routes: CommandRoute[];
  onSelect: (href: string) => void;
}

/**
 * ⌘K command palette (Master Context §6). Slice 0 registers only the live
 * routes; the AI query row is visible but disabled with a "Coming in Slice 8"
 * tooltip (per Slice 0 scope).
 */
export function CommandPalette({
  open,
  onOpenChange,
  routes,
  onSelect,
}: CommandPaletteProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-xl p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command>
          <CommandInput placeholder="Search routes and actions…" autoFocus />
          <CommandList className="max-h-80 overflow-y-auto p-1.5">
            <CommandEmpty className="text-muted py-6 text-center text-body-sm">
              No results.
            </CommandEmpty>

            {/* AI query row — disabled until Slice 8. */}
            <CommandGroup>
              <CommandItem
                disabled
                title="Coming in Slice 8"
                className="text-faint justify-between"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Ask ProcureFlow AI…
                </span>
                <span className="text-micro">Coming in Slice 8</span>
              </CommandItem>
            </CommandGroup>

            <CommandGroup>
              {routes.map((route) => (
                <CommandItem
                  key={route.href}
                  value={`${route.label} ${route.keywords ?? ''}`}
                  onSelect={() => {
                    onSelect(route.href);
                    onOpenChange(false);
                  }}
                >
                  {route.label}
                  <span className={cn('font-numeric text-faint ml-auto text-micro')}>
                    {route.href}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
