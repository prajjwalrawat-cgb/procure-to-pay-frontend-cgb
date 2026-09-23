'use client';

import {
  Button,
  CommandPalette,
  TopNav,
  type CommandRoute,
  type TopNavItem,
  useTableStackLabels,
} from '@/components/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';

import { VENDOR_LIVE_ROUTES, VENDOR_PRIMARY_NAV } from '@/vendor/config/nav';
import { endSession } from '@/lib/auth-session';
import { refreshAccessToken } from '@/vendor/lib/api-client';
import { useSessionStore } from '@/vendor/store/session-store';
import { useVendorUiStore } from '@/vendor/store/ui-store';

const LOGOUT_HREF = 'action:logout';

/**
 * The supplier shell. Same top-nav chrome as the buyer portal, differing only
 * in the destinations and in the brand line, which says "Supplier" so a person
 * with both logins can tell at a glance which side they are on.
 */
export function VendorShell({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clear } = useSessionStore();
  const { commandOpen, setCommandOpen } = useVendorUiStore();

  // Verify the session is still valid on load; the vendor shell reads no
  // tenanted API here, so we only refresh the token, not a profile.
  //
  // Through the shared single-flight refresher, NOT a raw fetch: a raw fetch
  // raced the portal's own 401-driven refresh, and since the refresh token
  // rotates the loser was told the session had ended.
  //
  // A failure ends the session through `endSession`, not `router.replace`: the
  // bare replace was answered by the middleware seeing the still-present (but
  // dead) refresh cookie and sending the vendor straight back here, so this
  // effect ran again and the page reloaded in a tight loop.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const accessToken = await refreshAccessToken();
      if (!accessToken && !cancelled) endSession('/vendor/login', clear);
    })();
    return () => {
      cancelled = true;
    };
  }, [clear]);

  // Cmd-K / Ctrl-K opens the command palette, same as the buyer portal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCommandOpen]);

  const logout = useCallback(async () => {
    await fetch(`/api/vendor/auth/logout`, { method: 'POST' });
    clear();
    router.replace('/vendor/login');
  }, [clear, router]);

  const commandRoutes: CommandRoute[] = [
    ...VENDOR_LIVE_ROUTES,
    { label: 'Logout', href: LOGOUT_HREF, keywords: 'sign out log out' },
  ];

  const onCommandSelect = (href: string): void => {
    if (href === LOGOUT_HREF) void logout();
    else router.push(href);
  };

  const renderLink = (item: TopNavItem, content: ReactNode): ReactNode => (
    <Link href={item.href}>{content}</Link>
  );

  // Labels `table.pf-stack` cells so they stack as cards on narrow screens.
  const mainRef = useRef<HTMLElement>(null);
  useTableStackLabels(mainRef);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper">
      <a href="#vendor-main" className="pf-skip-link">
        Skip to content
      </a>

      <TopNav
        brand={
          <Link href="/vendor" className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-accent text-white">
              <span className="text-caption font-bold">P</span>
            </span>
            <span className="hidden text-body font-semibold tracking-heading text-ink sm:inline">
              Supplier
            </span>
          </Link>
        }
        primary={VENDOR_PRIMARY_NAV}
        activeHref={pathname}
        renderLink={renderLink}
        onOpenSearch={() => setCommandOpen(true)}
        searchPlaceholder="Search orders, invoices, RFQs…"
        right={
          <>
            <span className="hidden text-caption text-muted sm:inline">
              {user?.name ?? 'Vendor'}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              Log out
            </Button>
          </>
        }
      />

      {/* One content container for the whole app.
       *
       * Left-aligned, not centred. Centring a 1400px column on a 1920px screen
       * put a 260px gutter down the left of every page — and since most pages
       * then capped themselves narrower still, the result was a wide margin on
       * the left and a wider void on the right. The gutter is now just the
       * padding, so content starts in the same place on every screen and the
       * cap only stops rows growing absurdly long on an ultra-wide monitor.
       *
       * Forms and wizards still cap their own measure from this same edge. */}
      <main
        ref={mainRef}
        id="vendor-main"
        className="flex-1 overflow-y-auto overscroll-contain py-4 sm:py-5 lg:py-6"
      >
        <div className="pf-container">{children}</div>
      </main>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        routes={commandRoutes}
        onSelect={onCommandSelect}
      />
    </div>
  );
}
