'use client';

import {
  Avatar,
  AvatarFallback,
  CommandPalette,
  TopNav,
  type CommandRoute,
  isTopNavMenu,
  type TopNavEntry,
  type TopNavItem,
} from '@/components/ui';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { NotificationsTray } from '@/components/notifications-tray';
import { LIVE_ROUTES, PRIMARY_NAV } from '@/config/nav';
import { useSidebarCounts } from '@/lib/api/inbox';
import { useUnreadCount } from '@/lib/api/notifications';
import { refreshAccessToken } from '@/lib/api-client';
import { endSession } from '@/lib/auth-session';
import { API_URL } from '@/lib/env';
import { useSessionStore, type SessionUser } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';

const LOGOUT_HREF = 'action:logout';

/**
 * The buyer shell.
 *
 * Chrome is a white two-row top bar, not a navy rail: identity and global
 * search on row one, section tabs on row two, and the work surface gets the
 * full width. See components/ui/components/top-nav.tsx for why.
 */
export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { commandOpen, setTrayOpen, setCommandOpen } = useUiStore();
  const { user, setSession, clear } = useSessionStore();
  const { data: approvalCounts } = useSidebarCounts();
  const { data: unread } = useUnreadCount();

  // Pending-approval counts ride on the nav items that own the queue. Those
  // items all sit inside dropdowns now, and each dropdown trigger sums its
  // items' badges — an approval queue nobody can see is one nobody clears.
  const withBadge = (item: TopNavItem): TopNavItem => {
    if (!approvalCounts) return item;
    if (item.href === '/inbox' && approvalCounts.total > 0) {
      return { ...item, badge: approvalCounts.total };
    }
    if (item.href === '/invoices' && approvalCounts.invoices > 0) {
      return { ...item, badge: approvalCounts.invoices };
    }
    if (item.href === '/payment-runs' && approvalCounts.paymentRuns > 0) {
      return { ...item, badge: approvalCounts.paymentRuns };
    }
    return item;
  };

  const primary = PRIMARY_NAV.map(
    (entry): TopNavEntry =>
      isTopNavMenu(entry) ? { ...entry, items: entry.items.map(withBadge) } : withBadge(entry),
  );

  /*
   * Bootstrap: exchange the httpOnly refresh cookie for an access token + load
   * the profile, so the nav can show who is signed in.
   *
   * Goes through the shared single-flight refresher, NOT a raw fetch. The
   * refresh token rotates on use, so two concurrent exchanges mean the second
   * presents a token the first already consumed and is told the session is
   * dead. A raw fetch here was a second caller outside the guard, racing every
   * query that mounted alongside this effect and 401'd on the empty in-memory
   * token — which is why a hard refresh signed people out intermittently.
   *
   * A failure ends the session through `endSession`, not `router.replace`. The
   * bare replace was a client-side nav that the middleware answered by seeing
   * the still-present (but dead) refresh cookie and sending the user straight
   * back here — so this effect ran again, failed again, and the page reloaded
   * in a tight loop. `endSession` flags the bounce so the middleware lets the
   * login page through.
   */
  useEffect(() => {
    if (user) return;
    let cancelled = false;
    void (async () => {
      const accessToken = await refreshAccessToken();
      if (!accessToken) {
        endSession('/login', clear);
        return;
      }
      const meRes = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) {
        endSession('/login', clear);
        return;
      }
      const me = (await meRes.json()) as SessionUser;
      if (!cancelled) setSession(accessToken, me);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, clear, setSession]);

  // ⌘K / Ctrl-K opens the command palette.
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
    await fetch('/api/auth/logout', { method: 'POST' });
    clear();
    router.replace('/login');
  }, [clear, router]);

  const commandRoutes: CommandRoute[] = [
    ...LIVE_ROUTES,
    { label: 'Logout', href: LOGOUT_HREF, keywords: 'sign out log out' },
  ];

  const onCommandSelect = (href: string): void => {
    if (href === LOGOUT_HREF) void logout();
    else router.push(href);
  };

  const renderLink = (item: TopNavItem, content: ReactNode): ReactNode => (
    <Link href={item.href}>{content}</Link>
  );

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const notificationCount = unread?.count ?? 0;

  return (
    <div className="bg-paper flex h-screen flex-col overflow-hidden">
      <a href="#main-content" className="pf-skip-link">
        Skip to content
      </a>

      <TopNav
        brand={
          <Link href="/" className="flex items-center gap-2">
            <span className="bg-accent flex h-6 w-6 items-center justify-center rounded-sm text-white">
              <span className="text-caption font-bold">P</span>
            </span>
            <span className="text-ink tracking-heading hidden text-body font-semibold sm:inline">
              ProcureFlow
            </span>
          </Link>
        }
        primary={primary}
        activeHref={pathname}
        renderLink={renderLink}
        onOpenSearch={() => setCommandOpen(true)}
        right={
          <>
            <button
              type="button"
              onClick={() => setTrayOpen(true)}
              className="text-muted hover:bg-canvas hover:text-text duration-hover relative rounded-sm p-1.5 transition-colors"
              aria-label={
                notificationCount > 0
                  ? `Notifications, ${notificationCount} unread`
                  : 'Notifications'
              }
            >
              <Bell className="h-4 w-4" aria-hidden />
              {notificationCount > 0 && (
                <span className="bg-accent absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-micro font-bold text-white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
            <AccountMenu
              initials={initials}
              user={user}
              onLogout={logout}
            />
          </>
        }
      />

      {/* overscroll-contain stops the chain: without it, hitting the bottom of
          the content carried on scrolling into whatever was behind it. */}
      {/* One content column for the whole app — `.pf-container` in styles.css.
       * Centred, and shared with the nav rows so the brand, the section tabs
       * and every page title start on the same line. Pages fill it; forms cap
       * themselves narrower and centre within it. */}
      <main
        id="main-content"
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
      <NotificationsTray />
    </div>
  );
}

/**
 * The avatar, as a menu.
 *
 * Identity and Logout only. Navigation belongs in the nav, and duplicating
 * destinations here would mean two places to keep in step. The organisation
 * name lives here too — it used to be appended to every page subheading as
 * a dot-joined "Acme Ltd" suffix, which repeated it ninety times and told
 * you nothing on the eighty-ninth.
 */
function AccountMenu({
  initials,
  user,
  onLogout,
}: {
  initials: string;
  user: SessionUser | null;
  onLogout: () => Promise<void>;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  // Escape and outside-click, so the menu behaves like a menu rather than a
  // panel you have to tap the avatar again to dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    // pointerdown, not mousedown: it covers touch and pen directly rather than
    // relying on a mobile browser synthesising a mouse event after the tap.
    const onPointer = (e: PointerEvent): void => {
      if (!(e.target as HTMLElement).closest('[data-account-menu]')) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div className="relative" data-account-menu>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className="flex items-center rounded-full"
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </button>

      {open ? (
        <div
          role="menu"
          className="border-line bg-panel absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border shadow-lg"
        >
          <div className="border-line border-b px-3 py-2.5">
            <p className="text-ink truncate text-body-sm font-medium">
              {user?.name ?? 'Signed in'}
            </p>
            {user?.email ? (
              <p className="text-muted truncate text-caption">{user.email}</p>
            ) : null}
            {user?.tenant?.name ? (
              <p className="text-faint mt-1 truncate text-caption">{user.tenant.name}</p>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="text-text hover:bg-canvas block w-full px-3 py-2 text-left text-body-sm"
            onClick={() => {
              setOpen(false);
              void onLogout();
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
