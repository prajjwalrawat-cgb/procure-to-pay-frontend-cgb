import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's stock font sizes. Without this it reads
 * `text-caption` as a text *colour* and drops `text-muted` beside it (or the
 * other way round) — so the type-scale names are registered as font sizes.
 * Keep in sync with tokens.ts → typeScale and the preset's legacy aliases.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'h1',
            'h2',
            'h3',
            'body',
            'body-sm',
            'caption',
            'micro',
            'meta',
            'base',
            'heading',
          ],
        },
      ],
    },
  },
});

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
