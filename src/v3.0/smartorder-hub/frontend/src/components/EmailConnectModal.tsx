import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  PlugZap,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type { OrderMessage } from '../types/message';
import type {
  EmailConfig,
  EmailStatus,
  EmailTestResult,
} from '../types/email';
import { useI18n } from '../i18n/I18nContext';
import {
  connectEmail,
  disconnectEmail,
  fetchEmailStatus,
  syncEmail,
  testEmailConnection,
} from '../services/emailApi';

interface EmailConnectModalProps {
  isOpen: boolean;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onMessagesIngested: (messages: OrderMessage[]) => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const EMPTY_FORM: EmailConfig = {
  host: 'imap.gmail.com',
  port: 993,
  username: '',
  password: '',
  mailbox: 'INBOX',
  useSsl: true,
};

export const EmailConnectModal: React.FC<EmailConnectModalProps> = ({
  isOpen,
  canManage,
  onClose,
  onChanged,
  onMessagesIngested,
  onNotify,
}) => {
  const { t } = useI18n();
  const tRef = useRef(t);
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [form, setForm] = useState<EmailConfig>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState<
    'test' | 'save' | 'sync' | 'disconnect' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<EmailTestResult | null>(null);
  const [showForm, setShowForm] = useState(true);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setTestResult(null);

    fetchEmailStatus()
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        setShowForm(next.source !== 'environment');
        setForm({
          host: next.host || EMPTY_FORM.host,
          port: next.port || EMPTY_FORM.port,
          username: next.username || '',
          password: '',
          mailbox: next.mailbox || EMPTY_FORM.mailbox,
          useSsl: next.useSsl ?? true,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : tRef.current('email.loadError')
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen || !canManage) return null;

  const handleClose = () => {
    setForm((previous) => ({ ...previous, password: '' }));
    setTestResult(null);
    setError(null);
    onClose();
  };

  const configured = Boolean(status?.configured);
  const usingServerSecrets = status?.source === 'environment';

  const updateForm = <K extends keyof EmailConfig>(
    key: K,
    value: EmailConfig[K]
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleTest = async () => {
    if (!canManage) return;
    if (
      !form.host.trim() ||
      !form.username.trim() ||
      (!form.password.trim() && !configured)
    ) {
      setError(t('email.required'));
      return;
    }
    const formDiffers =
      configured &&
      (form.host.trim() !== (status?.host ?? '') ||
        form.port !== (status?.port ?? 993) ||
        form.username.trim() !== (status?.username ?? '') ||
        form.mailbox.trim() !== (status?.mailbox ?? 'INBOX') ||
        form.useSsl !== (status?.useSsl ?? true));
    if (formDiffers && !form.password.trim()) {
      setError(t('email.passwordRequiredToTest'));
      return;
    }
    setBusy('test');
    setError(null);
    setTestResult(null);
    try {
      const result =
        form.password.trim() || !configured
          ? await testEmailConnection(form)
          : await testEmailConnection();
      setTestResult(result);
      onNotify(
        t('email.testSuccess', {
          count: result.messages,
          mailbox: result.mailbox,
        }),
        'success'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('email.testError'));
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (!canManage) return;
    if (!form.host.trim() || !form.username.trim() || !form.password.trim()) {
      setError(t('email.required'));
      return;
    }
    setBusy('save');
    setError(null);
    try {
      const result = await connectEmail(form);
      setStatus(result.status);
      setForm((previous) => ({ ...previous, password: '' }));
      onNotify(t('email.connectSuccess'), 'success');

      try {
        const synced = await syncEmail();
        onMessagesIngested(synced.messages);
        if (synced.messages.length > 0) {
          onNotify(
            t('email.syncSuccess', { count: synced.messages.length }),
            'success'
          );
        } else {
          onNotify(t('email.syncNone'), 'info');
        }
      } catch (syncErr: unknown) {
        onNotify(
          syncErr instanceof Error ? syncErr.message : t('email.syncError'),
          'error'
        );
      }

      await onChanged();
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('email.connectError'));
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    if (!canManage) return;
    setBusy('sync');
    setError(null);
    try {
      const result = await syncEmail();
      onMessagesIngested(result.messages);
      if (result.messages.length > 0) {
        onNotify(
          t('email.syncSuccess', { count: result.messages.length }),
          'success'
        );
      } else {
        onNotify(t('email.syncNone'), 'info');
      }
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('email.syncError'));
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!canManage) return;
    setBusy('disconnect');
    setError(null);
    try {
      const next = await disconnectEmail();
      setStatus(next);
      setShowForm(true);
      setTestResult(null);
      setForm((previous) => ({ ...previous, password: '' }));
      onNotify(t('email.disconnectSuccess'), 'info');
      await onChanged();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('email.disconnectError')
      );
    } finally {
      setBusy(null);
    }
  };

  const busyLabel =
    busy === 'test'
      ? t('email.testing')
      : busy === 'save'
        ? t('email.saving')
        : busy === 'sync'
          ? t('email.syncing')
          : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#fffdf8] border border-amber-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-amber-100 bg-amber-50/60">
          <div className="flex items-start gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {t('email.title')}
              </h2>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {t('email.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-amber-100 transition"
            aria-label={t('email.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-3.5 overflow-y-auto">
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 flex items-start gap-2">
            <PlugZap className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-amber-900">
              {t('email.demoNote')}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-stone-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('email.loading')}
            </div>
          ) : (
            <>
              {configured && status && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {usingServerSecrets
                        ? t('email.envSource')
                        : t('email.sessionSource')}
                    </p>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700">
                      {t('email.pollHint', {
                        seconds: status.pollSeconds,
                      })}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-emerald-900/80">
                    <p className="truncate">
                      <span className="font-semibold">
                        {t('email.host')}:
                      </span>{' '}
                      {status.host}
                    </p>
                    <p className="truncate">
                      <span className="font-semibold">
                        {t('email.username')}:
                      </span>{' '}
                      {status.username}
                    </p>
                    <p className="truncate">
                      <span className="font-semibold">
                        {t('email.mailbox')}:
                      </span>{' '}
                      {status.mailbox}
                    </p>
                    <p className="truncate">
                      <span className="font-semibold">
                        {t('email.lastSync')}:
                      </span>{' '}
                      {status.channel.lastSyncAt
                        ? new Date(status.channel.lastSyncAt).toLocaleString()
                        : t('channels.never')}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {testResult && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-800 flex items-start gap-2">
                  <Server className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {t('email.testResult', {
                      count: testResult.messages,
                      mailbox: testResult.mailbox,
                    })}
                  </span>
                </div>
              )}

              {showForm ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2.5">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-stone-700">
                        {t('email.host')}
                      </span>
                      <input
                        type="text"
                        value={form.host}
                        onChange={(event) =>
                          updateForm('host', event.target.value)
                        }
                        placeholder={t('email.hostPlaceholder')}
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-stone-700">
                        {t('email.port')}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={form.port}
                        onChange={(event) =>
                          updateForm(
                            'port',
                            Number(event.target.value) || 993
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-stone-700">
                      {t('email.username')}
                    </span>
                    <input
                      type="email"
                      value={form.username}
                      onChange={(event) =>
                        updateForm('username', event.target.value)
                      }
                      placeholder={t('email.usernamePlaceholder')}
                      autoComplete="username"
                      className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-stone-700 flex items-center gap-1">
                      <KeyRound className="w-3 h-3" />
                      {t('email.password')}
                    </span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        updateForm('password', event.target.value)
                      }
                      placeholder={t('email.passwordPlaceholder')}
                      autoComplete="new-password"
                      className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    {configured && (
                      <span className="mt-1 block text-[10px] text-stone-400">
                        {t('email.passwordKeep')}
                      </span>
                    )}
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-stone-700">
                        {t('email.mailbox')}
                      </span>
                      <input
                        type="text"
                        value={form.mailbox}
                        onChange={(event) =>
                          updateForm('mailbox', event.target.value)
                        }
                        placeholder={t('email.mailboxPlaceholder')}
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[11px] font-medium text-stone-700">
                      <input
                        type="checkbox"
                        checked={form.useSsl}
                        onChange={(event) =>
                          updateForm('useSsl', event.target.checked)
                        }
                        className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                      />
                      {t('email.useSsl')}
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[11px] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                    >
                      {busy === 'test' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Server className="w-3.5 h-3.5" />
                      )}
                      {busy === 'test'
                        ? t('email.testing')
                        : t('email.test')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                    >
                      {busy === 'save' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Mail className="w-3.5 h-3.5" />
                      )}
                      {busy === 'save'
                        ? t('email.saving')
                        : t('email.save')}
                    </button>
                    {configured && status?.source === 'session' && (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={Boolean(busy)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {busy === 'disconnect' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        {t('email.disconnect')}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={Boolean(busy)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[11px] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    {busy === 'test' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Server className="w-3.5 h-3.5" />
                    )}
                    {t('email.test')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={Boolean(busy)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                  >
                    {busy === 'sync' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {t('email.sync')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[11px] font-semibold text-stone-600 hover:bg-stone-50"
                  >
                    {t('email.override')}
                  </button>
                </div>
              )}

              {busyLabel && (
                <p className="text-[10px] text-stone-400 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {busyLabel}
                </p>
              )}

              <div className="rounded-xl bg-stone-100 p-3 text-[10px] leading-relaxed text-stone-500 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t('email.securityNote')}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-3 border-t border-amber-100 bg-amber-50/40">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100"
          >
            {t('email.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
