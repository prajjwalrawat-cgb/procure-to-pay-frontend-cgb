'use client';

import { Skeleton } from '@/components/ui';
import { BellOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  useMarkNotificationRead,
  useNotifications,
  type NotificationView,
} from '@/lib/api/notifications';
import { useUiStore } from '@/store/ui-store';

/** Notifications tray — live in-app notifications from the approval engine and
 *  other events. */
export function NotificationsTray(): React.JSX.Element | null {
  const { trayOpen, setTrayOpen } = useUiStore();
  const router = useRouter();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();

  if (!trayOpen) return null;

  const items = data ?? [];
  const unread = items.filter((n) => !n.readAt).length;

  const onOpen = (n: NotificationView): void => {
    if (!n.readAt) markRead.mutate(n.id);
    setTrayOpen(false);
    if (n.href) router.push(n.href);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close notifications"
        className="fixed inset-0 z-40 cursor-default"
        onClick={() => setTrayOpen(false)}
      />
      <aside className="border-line bg-panel fixed inset-x-4 top-16 z-50 max-h-[70vh] overflow-hidden rounded-lg border shadow-xl sm:left-auto sm:right-4 sm:w-96">
        <div className="border-line flex items-center justify-between border-b px-4 py-3">
          <span className="text-ink text-body-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <span className="bg-accent-wash text-accent rounded-full px-2 py-0.5 text-micro font-medium">
              {unread} unread
            </span>
          )}
        </div>

        <div className="max-h-[calc(70vh-48px)] overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col gap-4 px-4 py-4" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="text-muted flex flex-col items-center gap-2 py-10 text-center">
              <BellOff className="text-faint h-6 w-6" aria-hidden />
              <p className="text-caption">You&apos;re all caught up.</p>
            </div>
          )}

          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onOpen(n)}
              className={`border-line hover:bg-canvas flex w-full flex-col items-start gap-0.5 border-b px-4 py-3 text-left last:border-0 ${
                n.readAt ? '' : 'bg-accent-wash/40'
              }`}
            >
              <div className="flex w-full items-center gap-2">
                {!n.readAt && (
                  <span className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                )}
                <span className="text-ink flex-1 text-body-sm font-medium">{n.title}</span>
                <span className="text-faint shrink-0 text-micro">
                  {timeAgo(n.createdAt)}
                </span>
              </div>
              {n.body && <span className="text-muted pl-3.5 text-caption">{n.body}</span>}
              <span className="text-faint pl-3.5 text-micro">
                {typeLabel(n.type)}
              </span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}

/** `APPROVAL_REQUESTED` → "Approval requested". */
function typeLabel(type: string): string {
  const words = type.replace(/[._]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
