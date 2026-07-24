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
} from '@procureflow/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, type ReactNode } from 'react';

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
      {!focusMode && (
        <Sidebar
          brand={
            <div className="flex items-center gap-2">
              <span className="bg-ink flex h-6 w-6 items-center justify-center rounded-sm text-white">
                <span className="font-numeric text-[12px] font-bold">P</span>
              </span>
              {!sidebarCollapsed && (
                <span className="tracking-heading text-ink text-[14px] font-semibold">
                  ProcureFlow
                </span>
              )}
            </div>
          }
          groups={navGroups}
          activeHref={pathname}
          collapsed={sidebarCollapsed}
          renderLink={renderLink}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          onToggleSidebar={toggleSidebar}
          onOpenCommand={() => setCommandOpen(true)}
          onToggleFocus={toggleFocus}
          onOpenNotifications={() => setTrayOpen(true)}
          notificationCount={unread?.count ?? 0}
          right={
            <div className="flex items-center gap-2 pl-1">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                Logout
              </Button>
            </div>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
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
