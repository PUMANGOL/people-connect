import { apiClient } from './api.client';
import type { Notification, ApiResponse } from '@/lib/types';

export const notificationService = {
  getUnread: (limit = 10) =>
    apiClient
      .get<ApiResponse<Notification[]>>('/notifications', {
        params: { lida: false, limit },
      })
      .then((r) => r.data),

  markAsRead: (id: string) =>
    apiClient
      .patch<ApiResponse<Notification>>(`/notifications/${id}/lida`)
      .then((r) => r.data),

  markAllAsRead: () =>
    apiClient.patch<ApiResponse<void>>('/notifications/mark-all-read').then((r) => r.data),
};
