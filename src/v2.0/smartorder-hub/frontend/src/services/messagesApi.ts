/**
 * Inbox API client.
 *
 * The previous version kept messages in localStorage. Every call now goes to
 * the FastAPI service, so the activity log and the order records stay
 * consistent across refreshes and across demo devices.
 */

import {
  NewMessageInput,
  OrderMessage,
  RecognitionStatus,
} from '../types/message';
import { apiRequest } from './http';

export async function fetchMessages(): Promise<OrderMessage[]> {
  return apiRequest<OrderMessage[]>('/api/messages');
}

export async function createMessage(input: NewMessageInput): Promise<OrderMessage> {
  return apiRequest<OrderMessage>('/api/messages', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * The backend stores one message per request. The CSV importer still calls
 * this sequentially so message IDs and activity events stay in order.
 */
export async function importMessagesBatch(
  inputs: NewMessageInput[]
): Promise<OrderMessage[]> {
  const created: OrderMessage[] = [];
  for (const input of inputs) {
    created.push(await createMessage(input));
  }
  return created;
}

export async function analyzeMessageAsOrder(
  messageId: string,
  mode: 'auto' | 'ai' | 'rules' = 'auto'
): Promise<OrderMessage> {
  return apiRequest<OrderMessage>(`/api/messages/${messageId}/extract`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function updateMessageStatus(
  messageId: string,
  newStatus: RecognitionStatus,
  reviewNotes?: string
): Promise<OrderMessage> {
  return apiRequest<OrderMessage>(`/api/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus, reviewNotes }),
  });
}

export async function deleteMessage(messageId: string): Promise<void> {
  await apiRequest<void>(`/api/messages/${messageId}`, { method: 'DELETE' });
}

export async function resetMockData(): Promise<OrderMessage[]> {
  await apiRequest('/api/demo/reset', { method: 'POST' });
  return fetchMessages();
}
