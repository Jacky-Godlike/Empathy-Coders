import type { ChannelSyncResult } from '../types/channel';
import type {
  EmailConfig,
  EmailConnectResult,
  EmailStatus,
  EmailTestResult,
} from '../types/email';
import { apiRequest } from './http';

export function fetchEmailStatus(): Promise<EmailStatus> {
  return apiRequest<EmailStatus>('/api/email/status');
}

export function testEmailConnection(
  config?: EmailConfig
): Promise<EmailTestResult> {
  return apiRequest<EmailTestResult>('/api/email/test', {
    method: 'POST',
    body: config ? JSON.stringify(config) : undefined,
  });
}

export function connectEmail(config: EmailConfig): Promise<EmailConnectResult> {
  return apiRequest<EmailConnectResult>('/api/email/connect', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export function disconnectEmail(): Promise<EmailStatus> {
  return apiRequest<EmailStatus>('/api/email/config', {
    method: 'DELETE',
  });
}

export function syncEmail(): Promise<ChannelSyncResult> {
  return apiRequest<ChannelSyncResult>('/api/email/sync', {
    method: 'POST',
  });
}
