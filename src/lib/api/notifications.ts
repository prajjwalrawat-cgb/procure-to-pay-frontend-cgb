'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread-count'] as const,
};

/** Poll the tray list every 30s so approvals/updates surface without a refresh. */
export function useNotifications(): UseQueryResult<NotificationView[]> {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => apiFetch<NotificationView[]>('/notifications'),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useUnreadCount(): UseQueryResult<{ count: number }> {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => apiFetch<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead(): ReturnType<
  typeof useMutation<{ ok: true }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
      qc.invalidateQueries({ queryKey: notificationKeys.unread });
    },
  });
}
