import type { Channel, ChannelSyncAllResult, ChannelSyncResult } from '../types/channel';
import { API_BASE, apiRequest } from './http';

export function fetchChannels(): Promise<Channel[]> {
  return apiRequest<Channel[]>('/api/channels');
}

export function connectChannel(channelId: string): Promise<Channel> {
  return apiRequest<Channel>(`/api/channels/${channelId}/connect`, {
    method: 'POST',
  });
}

export function disconnectChannel(channelId: string): Promise<Channel> {
  return apiRequest<Channel>(`/api/channels/${channelId}/disconnect`, {
    method: 'POST',
  });
}

export function setChannelAutoSync(
  channelId: string,
  autoSync: boolean
): Promise<Channel> {
  return apiRequest<Channel>(`/api/channels/${channelId}`, {
    method: 'PATCH',
    body: JSON.stringify({ autoSync }),
  });
}

export function syncChannel(channelId: string): Promise<ChannelSyncResult> {
  return apiRequest<ChannelSyncResult>(`/api/channels/${channelId}/sync`, {
    method: 'POST',
  });
}

export function syncAllChannels(): Promise<ChannelSyncAllResult> {
  return apiRequest<ChannelSyncAllResult>('/api/channels/sync-all', {
    method: 'POST',
  });
}

export function channelWebhookUrl(channel: Channel): string {
  try {
    return new URL(
      `${API_BASE}${channel.webhookPath}`,
      window.location.origin
    ).href;
  } catch {
    return channel.webhookPath;
  }
}
