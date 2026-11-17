import { apiClient } from './api.client';
import type { ChatRequest, ChatResponse, ApiResponse } from '@/lib/types';

export const chatbotService = {
  sendMessage: (request: ChatRequest) =>
    apiClient.post<ApiResponse<ChatResponse>>('/chat/message', request).then((r) => r.data),
};
