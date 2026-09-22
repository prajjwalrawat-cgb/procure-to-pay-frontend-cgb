import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'bg-panel flex h-full w-full flex-col overflow-hidden rounded-lg',
      className,
    )}
    {...props}
  />
));
Command.displayName = 'Command';

export function CommandInput({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>): React.JSX.Element {
  return (
    <div className="border-line flex items-center gap-2 border-b px-3">
      <Search className="text-faint h-4 w-4 shrink-0" />
      <CommandPrimitive.Input
        className={cn(
          'text-text placeholder:text-faint flex h-11 w-full bg-transparent text-body-sm outline-none',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export const CommandList = CommandPrimitive.List;
export const CommandEmpty = CommandPrimitive.Empty;
export const CommandGroup = CommandPrimitive.Group;
export const CommandSeparator = CommandPrimitive.Separator;

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'text-text flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-body-sm outline-none',
      'data-[selected=true]:bg-canvas data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = 'CommandItem';
