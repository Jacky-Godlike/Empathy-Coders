import type { MessageSource, OrderMessage } from './message';

export type ChannelStatus = 'connected' | 'needs_attention' | 'not_connected';

export interface Channel {
  id: string;
  source: MessageSource;
  name: string;
  account: string;
  connectionMode: string;
  description: string;
  status: ChannelStatus;
  autoSync: boolean;
  lastSyncAt: string | null;
  importedCount: number;
  lastError: string | null;
  webhookPath: string;
}

export interface ChannelSyncResult {
  channel: Channel;
  messages: OrderMessage[];
}

export interface ChannelSyncAllResult {
  channels: Channel[];
  messages: OrderMessage[];
  syncedChannels: number;
}
