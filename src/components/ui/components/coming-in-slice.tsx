import { Construction } from 'lucide-react';
import * as React from 'react';

export interface ComingInSliceProps {
  number: number;
  name: string;
}

/**
 * Placeholder for any screen not yet in scope (Master Context §1: stub, do not
 * silently implement). Rendered by every non-Slice-0 route.
 */
export function ComingInSlice({ number, name }: ComingInSliceProps): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="bg-accent-wash text-accent-2 flex h-12 w-12 items-center justify-center rounded-lg">
        <Construction className="h-6 w-6" />
      </div>
      <div>
        <h2 className="tracking-heading text-ink text-[16px] font-semibold">{name}</h2>
        <p className="text-muted mt-1 text-[13px]">
          Coming in <span className="font-numeric">Slice {number}</span>
        </p>
      </div>
    </div>
  );
}
