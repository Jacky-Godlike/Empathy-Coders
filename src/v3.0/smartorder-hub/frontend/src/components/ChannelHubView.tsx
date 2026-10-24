import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Cable,
  CheckCircle2,
  Copy,
  Inbox,
  Link2,
  Loader2,
  Lock,
  Mail,
  PlugZap,
  RefreshCw,
  Server,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Channel } from '../types/channel';
import type { EmailStatus } from '../types/email';
import type { OrderMessage } from '../types/message';
import type { CurrentUser } from '../types/user';
import { useI18n } from '../i18n/I18nContext';
import {
  channelWebhookUrl,
  connectChannel,
  disconnectChannel,
  fetchChannels,
  setChannelAutoSync,
  syncAllChannels,
  syncChannel,
} from '../services/channelsApi';
import { fetchEmailStatus } from '../services/emailApi';
import { EmailConnectModal } from './EmailConnectModal';

interface ChannelHubViewProps {
  currentUser: CurrentUser;
  onMessagesIngested: (messages: OrderMessage[]) => void;
  onOpenInbox: () => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const statusStyles: Record<Channel['status'], string> = {
  connected: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  needs_attention: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  not_connected: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

function relativeTime(iso: string | null, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (!iso) return t('channels.never');
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t('channels.never');
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('time.yesterday');
  return t('time.daysAgo', { count: days });
}

export const ChannelHubView: React.FC<ChannelHubViewProps> = ({
  currentUser,
  onMessagesIngested,
  onOpenInbox,
  onNotify,
}) => {
  const { t } = useI18n();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recentImports, setRecentImports] = useState<OrderMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const actionLock = useRef(false);
  const canManage = currentUser.role === 'owner';

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextChannels, nextEmail] = await Promise.all([
        fetchChannels(),
        fetchEmailStatus(),
      ]);
      setChannels(nextChannels);
      setEmailStatus(nextEmail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('hub.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const connected = channels.filter((channel) => channel.status === 'connected');
  const attention = channels.filter((channel) => channel.status === 'needs_attention');
  const unavailable = channels.filter((channel) => channel.status === 'not_connected');
  const importedTotal = channels.reduce((total, channel) => total + channel.importedCount, 0);
  const webhookSample = channels[0] ? channelWebhookUrl(channels[0]) : '';

  const summary = useMemo(
    () => [
      {
        label: t('hub.connectedCount'),
        value: connected.length,
        Icon: Wifi,
        tone: 'bg-emerald-50 text-emerald-700',
      },
      {
        label: t('channels.messagesImported'),
        value: importedTotal,
        Icon: Inbox,
        tone: 'bg-blue-50 text-blue-700',
      },
      {
        label: t('hub.needsAttentionCount'),
        value: attention.length + unavailable.length,
        Icon: AlertCircle,
        tone: 'bg-amber-50 text-amber-700',
      },
    ],
    [attention.length, connected.length, importedTotal, t, unavailable.length]
  );

  const handleExternalIngested = useCallback(
    (messages: OrderMessage[]) => {
      if (messages.length > 0) {
        setRecentImports((previous) =>
          [...messages, ...previous].slice(0, 5)
        );
      }
      onMessagesIngested(messages);
    },
    [onMessagesIngested]
  );

  const handleSync = async (channel: Channel) => {
    if (!canManage || actionLock.current) return;
    if (channel.source === 'email' && !emailStatus?.configured) {
      setIsEmailModalOpen(true);
      return;
    }
    actionLock.current = true;
    setWorkingId(channel.id);
    try {
      const result = await syncChannel(channel.id);
      setChannels((previous) =>
        previous.map((item) => (item.id === result.channel.id ? result.channel : item))
      );
      setRecentImports((previous) => [...result.messages, ...previous].slice(0, 5));
      onMessagesIngested(result.messages);
      onNotify(t('channels.syncSuccess', { count: result.messages.length, channel: channel.name }), 'success');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('hub.syncError'), 'error');
    } finally {
      actionLock.current = false;
      setWorkingId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!canManage || actionLock.current) return;
    actionLock.current = true;
    setIsSyncingAll(true);
    try {
      const result = await syncAllChannels();
      setChannels(result.channels);
      setRecentImports((previous) => [...result.messages, ...previous].slice(0, 5));
      onMessagesIngested(result.messages);
      onNotify(
        t('channels.syncAllSuccess', {
          count: result.messages.length,
          channels: result.syncedChannels,
        }),
        'success'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('hub.syncError'), 'error');
    } finally {
      actionLock.current = false;
      setIsSyncingAll(false);
    }
  };

  const handleConnect = async (channel: Channel) => {
    if (!canManage || actionLock.current) return;
    actionLock.current = true;
    setWorkingId(channel.id);
    try {
      const updated = await connectChannel(channel.id);
      setChannels((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item))
      );
      onNotify(t('channels.connectSuccess', { channel: channel.name }), 'success');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('hub.connectError'), 'error');
    } finally {
      actionLock.current = false;
      setWorkingId(null);
    }
  };

  const handleDisconnect = async (channel: Channel) => {
    if (!canManage || actionLock.current) return;
    actionLock.current = true;
    setWorkingId(channel.id);
    try {
      const updated = await disconnectChannel(channel.id);
      setChannels((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item))
      );
      onNotify(t('channels.disconnectSuccess', { channel: channel.name }), 'info');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('hub.connectError'), 'error');
    } finally {
      actionLock.current = false;
      setWorkingId(null);
    }
  };

  const handleAutoSync = async (channel: Channel) => {
    if (!canManage || actionLock.current) return;
    actionLock.current = true;
    setWorkingId(channel.id);
    try {
      const updated = await setChannelAutoSync(channel.id, !channel.autoSync);
      setChannels((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item))
      );
      onNotify(
        updated.autoSync
          ? t('channels.autoSyncOn', { channel: channel.name })
          : t('channels.autoSyncOff', { channel: channel.name }),
        'info'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('hub.connectError'), 'error');
    } finally {
      actionLock.current = false;
      setWorkingId(null);
    }
  };

  const handleCopyWebhook = async () => {
    if (!webhookSample) return;
    try {
      await navigator.clipboard.writeText(webhookSample);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      onNotify(t('hub.copyError'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 flex items-start gap-2.5">
        <PlugZap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">{t('hub.demoTitle')}</p>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
            {t('hub.demoBody')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2.5">
        {summary.map(({ label, value, Icon, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <span className={`p-1.5 rounded-lg ${tone}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('hub.connectionsTitle')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('hub.connectionsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </button>
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={!canManage || isSyncingAll || connected.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
          >
            {isSyncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {isSyncingAll ? t('channels.syncing') : t('channels.syncAll')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={load} className="ml-auto font-semibold underline">
            {t('common.retry')}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {channels.map((channel) => {
            const busy = workingId === channel.id;
            const isConnected = channel.status === 'connected';
            const isAttention = channel.status === 'needs_attention';
            const isEmail = channel.source === 'email';
            const emailReady = Boolean(emailStatus?.configured);
            return (
              <article
                key={channel.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-700 text-white flex items-center justify-center shrink-0">
                      <Cable className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{channel.name}</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{channel.account}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold shrink-0 ${statusStyles[channel.status]}`}>
                    {isConnected ? <Wifi className="w-2.5 h-2.5" /> : isAttention ? <AlertCircle className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                    {isConnected ? t('channels.connected') : isAttention ? t('channels.needsAttention') : t('channels.notConnected')}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t(`channel.${channel.source}.desc`)}
                </p>

                {isEmail && (
                  <div className="flex items-center gap-1.5 text-[9px] font-semibold">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
                        emailReady
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      <Mail className="w-2.5 h-2.5" />
                      {emailReady
                        ? t('email.liveImap')
                        : t('email.demoMode')}
                    </span>
                    {emailReady && (
                      <span className="text-slate-400 font-normal">
                        {t('email.readOnly')}
                      </span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-400 uppercase tracking-wide">{t('channels.lastSync')}</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{relativeTime(channel.lastSyncAt, t)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-slate-400 uppercase tracking-wide">{t('hub.imported')}</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{channel.importedCount}</p>
                  </div>
                </div>

                {isAttention && channel.lastError && (
                  <p
                    title={channel.lastError}
                    className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2 py-1.5"
                  >
                    {t('channels.reconnectRequired')}
                  </p>
                )}

                {isEmail && isConnected && channel.lastError && (
                  <p
                    title={channel.lastError}
                    className="text-[10px] text-rose-700 bg-rose-50 rounded-lg px-2 py-1.5 line-clamp-2"
                  >
                    {channel.lastError}
                  </p>
                )}

                {isEmail && canManage && (
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-2 py-1.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    <Server className="w-3 h-3" />
                    {t('email.manage')}
                  </button>
                )}

                {isConnected && (
                  <label className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>{t('channels.autoSync')}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={channel.autoSync}
                      disabled={!canManage || busy || (isEmail && !emailReady)}
                      title={
                        isEmail && !emailReady
                          ? t('email.configureFirst')
                          : undefined
                      }
                      onClick={() => handleAutoSync(channel)}
                      className={`relative w-8 h-4.5 rounded-full transition disabled:opacity-50 ${channel.autoSync ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition ${channel.autoSync ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </label>
                )}

                <div className="mt-auto flex items-center gap-1.5">
                  {isConnected ? (
                    <>
                      <button
                        type="button"
                        disabled={!canManage || busy}
                        onClick={() => handleSync(channel)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        {t('channels.sync')}
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || busy}
                        onClick={() => handleDisconnect(channel)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                      >
                        {t('channels.disconnect')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={!canManage || busy}
                      onClick={() =>
                        isEmail
                          ? setIsEmailModalOpen(true)
                          : handleConnect(channel)
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold disabled:opacity-50"
                    >
                      {isEmail ? (
                        <Mail className="w-3 h-3" />
                      ) : busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Link2 className="w-3 h-3" />
                      )}
                      {isEmail
                        ? t('email.connect')
                        : isAttention
                          ? t('channels.reconnect')
                          : t('channels.connect')}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-2.5">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center gap-2">
            <Cable className="w-4 h-4 text-amber-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{t('channels.howTitle')}</h2>
          </div>
          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {[
              ['1', t('channels.step1Title'), t('channels.step1Body')],
              ['2', t('channels.step2Title'), t('channels.step2Body')],
              ['3', t('channels.step3Title'), t('channels.step3Body')],
              ['4', t('channels.step4Title'), t('channels.step4Body')],
            ].map(([number, title, body]) => (
              <div key={number} className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-2.5 flex gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0">{number}</span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{t('channels.securityTitle')}</h2>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t('channels.securityBody')}</p>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{t('channels.webhookTitle')}</p>
            <code className="mt-1 block text-[9px] font-mono text-slate-600 dark:text-slate-300 break-all">{webhookSample || '/api/channels/{id}/webhook'}</code>
            <button
              type="button"
              onClick={handleCopyWebhook}
              disabled={!webhookSample}
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 disabled:opacity-40"
            >
              {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? t('common.copied') : t('common.copy')}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 flex items-start gap-1.5">
            <Lock className="w-3 h-3 shrink-0 mt-0.5" />
            {t('channels.requiresBackend')}
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{t('channels.recentImports')}</h2>
          </div>
          <button type="button" onClick={onOpenInbox} className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            {t('common.viewInbox')} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {recentImports.length === 0 ? (
          <p className="text-[11px] text-slate-400 mt-3">{t('channels.noImports')}</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {recentImports.map((message) => (
              <div key={message.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{message.sender}</p>
                  <p className="text-[10px] text-slate-400 truncate">{message.originalText}</p>
                </div>
                <span className="text-[9px] uppercase font-bold text-slate-400 shrink-0">{t(`source.${message.source}`)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <EmailConnectModal
        isOpen={isEmailModalOpen}
        canManage={canManage}
        onClose={() => setIsEmailModalOpen(false)}
        onChanged={load}
        onMessagesIngested={handleExternalIngested}
        onNotify={onNotify}
      />
    </div>
  );
};
