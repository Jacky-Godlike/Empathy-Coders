import type { Channel } from './channel';

export interface EmailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  mailbox: string;
  useSsl: boolean;
}

export interface EmailStatus {
  configured: boolean;
  source: 'environment' | 'session' | null;
  host: string | null;
  port: number | null;
  username: string | null;
  mailbox: string | null;
  useSsl: boolean | null;
  maxMessages: number;
  maxMessageBytes: number;
  pollSeconds: number;
  passwordSet: boolean;
  channel: Channel;
}

export interface EmailTestResult {
  ok: boolean;
  host: string;
  username: string;
  mailbox: string;
  messages: number;
}

export interface EmailConnectResult {
  status: EmailStatus;
  test: EmailTestResult;
}
