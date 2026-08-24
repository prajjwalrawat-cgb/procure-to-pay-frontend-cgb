'use client';

import {
  Avatar,
  AvatarFallback,
  Button,
  CommandPalette,
  Sidebar,
  Topbar,
  type CommandRoute,
  type NavItem,
} from '@/components/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { NotificationsTray } from '@/components/notifications-tray';
import { LIVE_ROUTES, NAV_GROUPS } from '@/config/nav';
import { useSidebarCounts } from '@/lib/api/inbox';
import { useUnreadCount } from '@/lib/api/notifications';
import { API_URL } from '@/lib/env';
import { useSessionStore, type SessionUser } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';

const LOGOUT_HREF = 'action:logout';

export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarCollapsed,
    focusMode,
    commandOpen,
    toggleSidebar,
    toggleFocus,
    setTrayOpen,
    setCommandOpen,
  } = useUiStore();
  const { user, setSession, clear } = useSessionStore();
  const { data: approvalCounts } = useSidebarCounts();
  const { data: unread } = useUnreadCount();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Navigating from the drawer should close it; otherwise the new page renders
  // behind an overlay that is still up.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Inject pending-approval badges onto the Inbox + Invoices nav items.
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => {
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
    }),
  }));

  // Bootstrap: exchange the httpOnly refresh cookie for an access token + load
  // the profile, so the topbar can show who is signed in.
  useEffect(() => {
    if (user) return;
    let cancelled = false;
    void (async () => {
      const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!refreshed.ok) {
        router.replace('/login');
        return;
      }
      const { accessToken } = (await refreshed.json()) as { accessToken: string };
      const meRes = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) {
        router.replace('/login');
        return;
      }
      const me = (await meRes.json()) as SessionUser;
      if (!cancelled) setSession(accessToken, me);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, router, setSession]);

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

  const renderLink = (item: NavItem, content: ReactNode): ReactNode => (
    <Link href={item.href}>{content}</Link>
  );

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="bg-paper flex h-screen overflow-hidden">
      <a href="#main-content" className="pf-skip-link">
        Skip to content
      </a>

      {!focusMode && (
        <Sidebar
          brand={
            <div className="flex items-center gap-2">
              <span className="bg-gold text-navy flex h-6 w-6 items-center justify-center rounded-sm">
                <span className="font-numeric text-[12px] font-bold">P</span>
              </span>
              {(!sidebarCollapsed || mobileNavOpen) && (
                <span className="tracking-heading text-on-navy text-[14px] font-semibold">
                  ProcureFlow
                </span>
              )}
            </div>
          }
          groups={navGroups}
          activeHref={pathname}
          collapsed={sidebarCollapsed}
          renderLink={renderLink}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          onToggleSidebar={toggleSidebar}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
          onToggleFocus={toggleFocus}
          onOpenNotifications={() => setTrayOpen(true)}
          notificationCount={unread?.count ?? 0}
          right={
            <div className="flex items-center gap-2 pl-1">
              <AccountMenu initials={initials} user={user} onLogout={logout} />
              <Button
                variant="onNavy"
                size="sm"
                onClick={() => void logout()}
                className="hidden sm:inline-flex"
              >
                Logout
              </Button>
            </div>
          }
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6"
        >
          {children}
        </main>
      </div>

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
 * The topbar's Logout button is `hidden sm:inline-flex`, so below 640px it does
 * not render — and the avatar used to be decoration with no click handler. That
 * left a phone-sized window with no way to sign out at all, which is also the
 * first thing anyone taps when they want to switch user. The menu carries the
 * signed-in identity too, because on a shared handset "who am I?" is the
 * question that precedes "log me out".
 *
 * Identity and Logout only. Navigation belongs in the sidebar, and duplicating
 * destinations here would mean two places to keep in step.
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
        className="flex items-center rounded-full focus-visible:ring-2 focus-visible:ring-white/60"
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </button>

      {open ? (
        <div
          role="menu"
          className="border-line absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border bg-white shadow-lg"
        >
          <div className="border-line border-b px-3 py-2">
            <p className="text-ink truncate text-[13px] font-medium">{user?.name ?? 'Signed in'}</p>
            {user?.email ? (
              <p className="text-muted truncate text-[12px]">{user.email}</p>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="text-danger hover:bg-canvas block w-full px-3 py-2 text-left text-[13px]"
            onClick={() => {
              setOpen(false);
              void onLogout();
            }}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
