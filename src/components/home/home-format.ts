import { inr, inrCompact } from '@/lib/format';

/**
 * Small formatters shared by the home command-center widgets. Kept here rather
 * than in lib/format because "4 min ago" and "↑ 12% vs …" are dashboard idioms,
 * not the app's canonical date/amount formats.
 */

/** "just now", "4 min ago", "3 h ago", "2 d ago" — then a plain date. */
export function relativeTime(iso: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return dayLabel(iso.slice(0, 10));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * 'YYYY-MM-DD' → "21 Sep". Parsed by hand, not via `new Date(day)`: series days
 * are UTC calendar days, and a Date would shift them by the viewer's offset.
 */
export function dayLabel(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`;
}

/** 'YYYY-MM-DD' → { day: "24", month: "Sep" } for a calendar chip. */
export function dayParts(day: string): { day: string; month: string } {
  const [, m, d] = day.slice(0, 10).split('-');
  return { day: String(Number(d)), month: MONTHS[Number(m) - 1] ?? '' };
}

/** "↑ 12% vs same days last month"; null when there is no baseline to compare. */
export function deltaText(deltaPct: number | null, basis: string): string | null {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return null;
  const rounded = Math.round(deltaPct);
  const arrow = rounded > 0 ? '↑' : rounded < 0 ? '↓' : '→';
  return `${arrow} ${Math.abs(rounded)}% ${basis}`.trim();
}

/**
 * Short rupee figure for dashboard tiles: "₹48.23 L" / "₹1.52 Cr" above a lakh,
 * whole rupees below it — `inrCompact` falls back to paise ("₹93,563.00"),
 * which is noise in a headline.
 */
export function inrShort(amount: string | number): string {
  const n = Number(amount);
  return Math.abs(n) >= 1e5 ? inrCompact(amount) : inr(amount, 0);
}
