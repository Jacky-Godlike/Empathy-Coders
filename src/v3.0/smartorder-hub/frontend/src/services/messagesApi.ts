/**
 * Inbox API client.
 *
 * The previous version kept messages in localStorage. Every call now goes to
 * the FastAPI service, so the activity log and the order records stay
 * consistent across refreshes and across demo devices.
 */

import {
  MessageSource,
  NewMessageInput,
  OrderMessage,
  RecognitionStatus,
} from '../types/message';
import { apiRequest } from './http';

/** Map a free-text CSV/platform value to a canonical source id. */
export const sourceFromText = (value: string | undefined): MessageSource => {
  const source = (value ?? '').toLowerCase();
  if (source.includes('facebook') || source.includes('messenger') || source === 'fb') {
    return 'facebook';
  }
  if (source.includes('instagram') || source === 'ig') return 'instagram';
  if (source.includes('telegram') || source === 'tg') return 'telegram';
  if (source.includes('tiktok') || source.includes('tik tok')) return 'tiktok';
  if (source.includes('email') || source.includes('mail')) return 'email';
  if (
    source.includes('manual') ||
    source.includes('call') ||
    source.includes('phone') ||
    source.includes('walk-in')
  ) {
    return 'manual';
  }
  return 'whatsapp';
};

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
