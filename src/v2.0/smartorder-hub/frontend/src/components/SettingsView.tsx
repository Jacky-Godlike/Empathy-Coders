import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  PlugZap,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Users,
  XCircle,
} from 'lucide-react';
import {
  AIStatus,
  AITestResult,
  AppView,
  IndustryProfile,
  Workspace,
} from '../types/order';
import {
  fetchAiStatus,
  switchIndustry,
  testAiConnection,
  updateRiskPolicy,
} from '../services/workspaceApi';
import { useI18n } from '../i18n/I18nContext';

interface SettingsViewProps {
  workspace: Workspace;
  onWorkspaceChanged: (workspace: Workspace) => void;
  onReset: () => Promise<void>;
  onNavigate: (view: AppView) => void;
}

const RISK_LABELS: Record<string, string> = {
  stock: 'Stock / capacity',
  delivery: 'Delivery feasibility',
  margin: 'Margin',
  data: 'Data completeness',
  anomaly: 'Order anomaly',
};

const RISK_COLORS: Record<string, string> = {
  stock: 'bg-emerald-500',
  delivery: 'bg-sky-500',
  margin: 'bg-amber-500',
  data: 'bg-violet-500',
  anomaly: 'bg-rose-500',
};

const industryTone = (id: string) => {
  const tones: Record<string, string> = {
    fnb: 'from-amber-500 to-orange-600',
    retail: 'from-sky-500 to-blue-600',
    wholesale: 'from-violet-500 to-indigo-600',
    services: 'from-teal-500 to-emerald-600',
    manufacturing: 'from-slate-500 to-slate-700',
    logistics: 'from-cyan-500 to-sky-700',
  };
  return tones[id] || 'from-emerald-500 to-teal-600';
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  workspace,
  onWorkspaceChanged,
  onReset,
  onNavigate,
}) => {
  const { t } = useI18n();
  const [selected, setSelected] = useState(workspace.industry.id);
  const [isApplying, setIsApplying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRefreshingAi, setIsRefreshingAi] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [ai, setAi] = useState<AIStatus>(workspace.ai);
  const [aiTest, setAiTest] = useState<AITestResult | null>(null);
  const [aiTestError, setAiTestError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyDraft, setPolicyDraft] = useState(workspace.rules);
  const [weightDraft, setWeightDraft] = useState(
    workspace.industry.riskWeights
  );

  useEffect(() => {
    setSelected(workspace.industry.id);
    setAi(workspace.ai);
    setPolicyDraft(workspace.rules);
    setWeightDraft(workspace.industry.riskWeights);
  }, [
    workspace.industry.id,
    workspace.industry.riskWeights,
    workspace.ai,
    workspace.rules,
  ]);

  const selectedProfile: IndustryProfile | undefined = useMemo(
    () => workspace.industries.find((profile) => profile.id === selected),
    [workspace.industries, selected]
  );

  const handleApplyIndustry = async () => {
    if (selected === workspace.industry.id) return;
    const profile = workspace.industries.find((item) => item.id === selected);
    const confirmed = window.confirm(
      t('settings.switchConfirm', { name: profile?.name ?? selected })
    );
    if (!confirmed) return;

    setIsApplying(true);
    setError(null);
    setNotice(null);
    try {
      const result = await switchIndustry(selected);
      onWorkspaceChanged(result.workspace);
      setNotice(
        t('settings.switchSuccess', { name: result.workspace.industry.name })
      );
      onNavigate('desk');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.switchError'));
    } finally {
      setIsApplying(false);
    }
  };

  const handleRefreshAi = async () => {
    setIsRefreshingAi(true);
    setError(null);
    try {
      const status = await fetchAiStatus();
      setAi(status);
      setNotice(
        status.configured
          ? t('settings.aiAvailable', {
              provider: status.providerLabel || status.provider,
              model: status.model,
            })
          : t('settings.aiMissing')
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.aiReadError'));
    } finally {
      setIsRefreshingAi(false);
    }
  };

  const handleTestAi = async () => {
    setIsTestingAi(true);
    setAiTest(null);
    setAiTestError(null);
    setError(null);
    try {
      const result = await testAiConnection();
      setAiTest(result);
      setAi(await fetchAiStatus());
      setNotice(result.message);
    } catch (err: unknown) {
      setAiTestError(err instanceof Error ? err.message : t('settings.aiTestError'));
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(t('settings.resetConfirm'));
    if (!confirmed) return;
    setIsResetting(true);
    setError(null);
    setNotice(null);
    try {
      await onReset();
      setNotice(t('settings.resetSuccess'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.resetError'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleSavePolicy = async () => {
    setIsSavingPolicy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateRiskPolicy(policyDraft, weightDraft);
      onWorkspaceChanged(updated);
      setPolicyDraft(updated.rules);
      setWeightDraft(updated.industry.riskWeights);
      setNotice(t('settings.policySaved'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.policySaveError'));
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const setPolicyValue = (
    key: keyof Workspace['rules'],
    entered: number
  ) => {
    const value =
      key === 'minMargin' || key === 'warnMargin' || key === 'minConfidence'
        ? entered / 100
        : entered;
    setPolicyDraft((current) => {
      switch (key) {
        case 'minMargin':
          return { ...current, minMargin: value };
        case 'warnMargin':
          return { ...current, warnMargin: value };
        case 'highValueThreshold':
          return { ...current, highValueThreshold: value };
        case 'leadTimeBufferDays':
          return { ...current, leadTimeBufferDays: value };
        case 'minConfidence':
          return { ...current, minConfidence: value };
        case 'riskMediumThreshold':
          return { ...current, riskMediumThreshold: value };
        case 'riskHighThreshold':
          return { ...current, riskHighThreshold: value };
        case 'riskCriticalThreshold':
          return { ...current, riskCriticalThreshold: value };
      }
    });
  };

  const weightEntries = Object.entries(weightDraft);
  const weightTotal = Object.values(weightDraft).reduce(
    (total, weight) => total + weight,
    0
  );
  const policyFields: Array<{
    key: keyof Workspace['rules'];
    label: string;
    value: string;
    hint: string;
  }> = [
    {
      key: 'minMargin',
      label: t('settings.minMargin'),
      value: `${(policyDraft.minMargin * 100).toFixed(0)}`,
      hint: t('settings.minMarginHint'),
    },
    {
      key: 'warnMargin',
      label: t('settings.warnMargin'),
      value: `${(policyDraft.warnMargin * 100).toFixed(0)}`,
      hint: t('settings.warnMarginHint'),
    },
    {
      key: 'highValueThreshold',
      label: t('settings.highValueReview'),
      value: `${policyDraft.highValueThreshold}`,
      hint: t('settings.highValueHint'),
    },
    {
      key: 'leadTimeBufferDays',
      label: t('settings.leadTimeBuffer'),
      value: `${policyDraft.leadTimeBufferDays}`,
      hint: t('settings.leadTimeHint'),
    },
    {
      key: 'minConfidence',
      label: t('settings.minConfidence'),
      value: `${(policyDraft.minConfidence * 100).toFixed(0)}`,
      hint: t('settings.minConfidenceHint'),
    },
    {
      key: 'riskMediumThreshold',
      label: t('settings.riskMediumThreshold'),
      value: `${policyDraft.riskMediumThreshold}`,
      hint: t('settings.riskBandHint'),
    },
    {
      key: 'riskHighThreshold',
      label: t('settings.riskHighThreshold'),
      value: `${policyDraft.riskHighThreshold}`,
      hint: t('settings.riskBandHint'),
    },
    {
      key: 'riskCriticalThreshold',
      label: t('settings.riskCriticalThreshold'),
      value: `${policyDraft.riskCriticalThreshold}`,
      hint: t('settings.riskBandHint'),
    },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Industry selector */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('settings.industryTitle')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              {t('settings.industryBody')}
            </p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('settings.current', { name: workspace.industry.name })}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5 mt-4">
          {workspace.industries.map((profile) => {
            const active = workspace.industry.id === profile.id;
            const picked = selected === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelected(profile.id)}
                className={`relative text-left rounded-xl border p-3 transition ${
                  picked
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${industryTone(
                      profile.id
                    )} text-white flex items-center justify-center text-xs font-bold shrink-0`}
                  >
                    {profile.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {profile.name}
                      </p>
                      {active && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                          {t('settings.currentBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {profile.tagline}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">
                    {profile.inventoryMode}
                  </span>
                  <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">
                    {t('settings.fieldsCount', { count: profile.fields.length })}
                  </span>
                  <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">
                    {t('settings.requiredCount', {
                      count: profile.requiredFields.length,
                    })}
                  </span>
                </div>
                {picked && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedProfile && (
          <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t('settings.orderFields', { name: selectedProfile.name })}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedProfile.fields.map((field) => (
                <span
                  key={field.key}
                  className={`text-[10px] rounded-full border px-2 py-0.5 ${
                    field.required
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              {t('settings.requiredNote')}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {t('settings.switchNote')}
          </p>
          <button
            onClick={handleApplyIndustry}
            disabled={isApplying || selected === workspace.industry.id}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
            {selected === workspace.industry.id
              ? t('settings.currentIndustry')
              : t('settings.useIndustry', {
                  name: selectedProfile?.name ?? t('settings.selectedIndustry'),
                })}
          </button>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* AI connection */}
        <section className="rounded-2xl border border-violet-200 dark:border-violet-900/70 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <PlugZap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('settings.aiTitle')}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {t('settings.aiBody')}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                ai.configured
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  ai.configured ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {ai.configured ? t('settings.aiConfigured') : t('settings.aiFallback')}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            {[
              [t('settings.aiProvider'), ai.providerLabel || ai.provider],
              [t('settings.aiModel'), ai.model],
              [
                t('settings.aiKeyVariable'),
                ai.keyEnv || (ai.provider === 'openai' ? 'AI_API_KEY' : 'GEMINI_API_KEY'),
              ],
              [t('settings.aiIntake'), ai.intakeMode],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-2"
              >
                <dt className="text-[9px] uppercase tracking-wider text-slate-400">
                  {label}
                </dt>
                <dd className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {!ai.configured && (
            <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/20 p-3">
              <p className="text-[10px] font-bold text-amber-800 dark:text-amber-200">
                {t('settings.addKeyTitle')}
              </p>
              <ol className="mt-1 space-y-1 text-[10px] text-amber-800/90 dark:text-amber-300/90 list-decimal list-inside leading-relaxed">
                <li>{t('settings.replitStep1')}</li>
                <li>
                  {t('settings.replitStep2', {
                    key: ai.keyEnv || 'GEMINI_API_KEY',
                  })}
                </li>
                <li>{t('settings.replitStep3')}</li>
                <li>{t('settings.replitStep4')}</li>
              </ol>
              <a
                href="https://docs.replit.com/core-concepts/project-editor/app-setup/secrets"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-200 underline"
              >
                {t('settings.replitGuide')}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}

          {aiTest && (
            <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-[10px] text-emerald-800 dark:text-emerald-200">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {aiTest.message}
              </div>
              <p className="mt-1 opacity-80">
                {aiTest.providerLabel} · {aiTest.model} · JSON{' '}
                {aiTest.jsonValid ? 'valid' : 'not valid'} · {aiTest.latencyMs} ms
              </p>
            </div>
          )}

          {aiTestError && (
            <div className="mt-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-[10px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{aiTestError}</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleTestAi}
              disabled={isTestingAi}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold disabled:opacity-60"
            >
              {isTestingAi ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PlugZap className="w-3.5 h-3.5" />
              )}
              {t('settings.aiTest')}
            </button>
            <button
              onClick={handleRefreshAi}
              disabled={isRefreshingAi}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshingAi ? 'animate-spin' : ''}`}
              />
              {t('settings.aiRefresh')}
            </button>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                {t('settings.aiWhereTitle')}
              </p>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              <code className="text-slate-700 dark:text-slate-300">
                backend/app/ai_client.py → generate_json()
              </code>{' '}
              is the only file that calls a provider.{' '}
              <code className="text-slate-700 dark:text-slate-300">
                backend/app/extraction.py → ai_extract()
              </code>{' '}
              builds the industry-aware prompt and parses the JSON.
            </p>
            <div className="mt-2 space-y-1 font-mono text-[10px]">
              <p className="rounded bg-slate-900 text-emerald-300 px-2 py-1">
                AI_PROVIDER=gemini
              </p>
              <p className="rounded bg-slate-900 text-emerald-300 px-2 py-1">
                GEMINI_API_KEY=&lt;secret&gt;
              </p>
              <p className="rounded bg-slate-900 text-sky-300 px-2 py-1">
                GEMINI_MODEL=gemini-2.5-flash
              </p>
              <p className="rounded bg-slate-900 text-amber-300 px-2 py-1">
                SMARTORDERHUB_INTAKE_MODE=rules | auto
              </p>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                {t('settings.aiOtherProvider')}
              </summary>
              <div className="mt-1.5 space-y-1 font-mono text-[10px]">
                <p className="rounded bg-slate-900 text-violet-300 px-2 py-1">
                  AI_PROVIDER=openai
                </p>
                <p className="rounded bg-slate-900 text-violet-300 px-2 py-1">
                  AI_API_KEY=&lt;secret&gt;
                </p>
                <p className="rounded bg-slate-900 text-violet-300 px-2 py-1">
                  AI_BASE_URL=https://api.openai.com/v1
                </p>
                <p className="rounded bg-slate-900 text-violet-300 px-2 py-1">
                  AI_MODEL=gpt-4o-mini
                </p>
              </div>
            </details>
            <p className="text-[10px] text-slate-400 mt-2 flex items-start gap-1">
              <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
              {t('settings.aiSecurity')}
            </p>
          </div>
        </section>

        {/* Decision rules */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('settings.rulesTitle')}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('settings.rulesBody')}
          </p>

          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
            {policyFields.map((rule) => (
              <div
                key={rule.label}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div>
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    {rule.label}
                  </p>
                  <p className="text-[9px] text-slate-400">{rule.hint}</p>
                </div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {rule.key === 'highValueThreshold' ? 'RM' : ''}
                  <input
                    type="number"
                    min={0}
                    step={rule.key.includes('Margin') || rule.key === 'minConfidence' ? 1 : rule.key === 'leadTimeBufferDays' ? 1 : 10}
                    value={rule.value}
                    onChange={(event) =>
                      setPolicyValue(rule.key, Number(event.target.value))
                    }
                    className="w-20 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-right"
                    aria-label={rule.label}
                  />
                  {rule.key === 'minMargin' ||
                  rule.key === 'warnMargin' ||
                  rule.key === 'minConfidence'
                    ? '%'
                    : rule.key === 'leadTimeBufferDays'
                    ? t('settings.daysUnit')
                    : rule.key.startsWith('risk')
                    ? '/100'
                    : ''}
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSavePolicy}
            disabled={isSavingPolicy || Math.abs(weightTotal - 1) >= 0.001}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
          >
            {isSavingPolicy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('settings.savePolicy')}
          </button>

          <div className="mt-4 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t('settings.riskWeights')} · {workspace.industry.name}
            </p>
          </div>
          <div className="mt-2 space-y-2">
            {weightEntries.map(([key, weight]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-600 dark:text-slate-300">
                    {t(`settings.risk.${key}`)}
                  </span>
                  <label className="flex items-center gap-1 font-semibold text-slate-500">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={(weight * 100).toFixed(0)}
                      onChange={(event) =>
                        setWeightDraft((current) => ({
                          ...current,
                          [key]: Number(event.target.value) / 100,
                        }))
                      }
                      className="w-16 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-1 text-right"
                      aria-label={t(`settings.risk.${key}`)}
                    />
                    %
                  </label>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${RISK_COLORS[key] || 'bg-slate-400'}`}
                    style={{ width: `${Math.max(0, Math.min(100, Math.round(weight * 100)))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p
            className={`text-[10px] mt-2 ${
              Math.abs(weightTotal - 1) < 0.001
                ? 'text-slate-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {t('settings.weightTotal', {
              total: (weightTotal * 100).toFixed(0),
            })}
          </p>
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            {t('settings.scoreFormula')}
          </p>
        </section>
      </div>

      {/* Human roles */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('settings.teamTitle')}
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t('settings.teamBody')}
        </p>
        <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
          {[
            {
              role: t('settings.owner'),
              can: t('settings.ownerDesc'),
              cannot: t('settings.ownerCannot'),
            },
            {
              role: t('settings.staff'),
              can: t('settings.staffDesc'),
              cannot: t('settings.staffCannot'),
            },
          ].map((item) => (
            <div
              key={item.role}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-3"
            >
              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                {item.role}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {item.can}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                {item.cannot}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo controls */}
      <section className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              {t('settings.demoTitle')}
            </h2>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5 max-w-xl">
              {t('settings.demoBody')}
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={isResetting || isApplying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-60"
          >
            {isResetting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            {t('settings.resetNamed', { name: workspace.industry.name })}
          </button>
        </div>
      </section>
    </div>
  );
};
