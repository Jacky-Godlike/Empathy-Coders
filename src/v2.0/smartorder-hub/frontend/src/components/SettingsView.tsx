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
} from '../services/workspaceApi';

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

  useEffect(() => {
    setSelected(workspace.industry.id);
    setAi(workspace.ai);
  }, [workspace.industry.id, workspace.ai]);

  const selectedProfile: IndustryProfile | undefined = useMemo(
    () => workspace.industries.find((profile) => profile.id === selected),
    [workspace.industries, selected]
  );

  const handleApplyIndustry = async () => {
    if (selected === workspace.industry.id) return;
    const profile = workspace.industries.find((item) => item.id === selected);
    const confirmed = window.confirm(
      `Switch the demo workspace to ${profile?.name ?? selected}?\n\n` +
        'This reloads the synthetic catalog, suppliers and inbox for that ' +
        'industry. Current demo orders and activity will be reset.'
    );
    if (!confirmed) return;

    setIsApplying(true);
    setError(null);
    setNotice(null);
    try {
      const result = await switchIndustry(selected);
      onWorkspaceChanged(result.workspace);
      setNotice(
        `Workspace switched to ${result.workspace.industry.name}. A fresh synthetic inbox is ready.`
      );
      onNavigate('desk');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not switch the industry'
      );
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
          ? `AI extraction is available via ${
              status.providerLabel || status.provider
            } · ${status.model}.`
          : 'No AI key detected. Rules fallback is active and fully functional.'
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not read the AI status'
      );
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
      setAiTestError(
        err instanceof Error ? err.message : 'The AI connection test failed'
      );
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      'Reset all demo data for the current industry?\n\n' +
        'Orders, approvals, purchase drafts and activity will return to the synthetic seed.'
    );
    if (!confirmed) return;
    setIsResetting(true);
    setError(null);
    setNotice(null);
    try {
      await onReset();
      setNotice('Demo data reset to the synthetic seed.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  const weightEntries = Object.entries(workspace.industry.riskWeights);
  const rules = workspace.rules;

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
                Business industry
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              The industry changes the order fields the extractor looks for,
              the catalog semantics, and the weights used by the risk score.
              Each profile ships with its own synthetic dataset.
            </p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Current: {workspace.industry.name}
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
                          Current
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
                    {profile.fields.length} fields
                  </span>
                  <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">
                    {profile.requiredFields.length} required
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
              Order fields for {selectedProfile.name}
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
              * required — a missing required field routes the order to Request
              info instead of accepting it.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Switching reloads synthetic data. No real customer data is involved.
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
              ? 'Current industry'
              : `Use ${selectedProfile?.name ?? 'selected industry'}`}
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
                  Connect AI API
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                AI is used only to classify a message and extract structured
                fields. Stock, profit, delivery and risk are always calculated
                by explicit rules — never by the model.
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
              {ai.configured ? 'Key detected' : 'Rules fallback'}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            {[
              ['Provider', ai.providerLabel || ai.provider],
              ['Model', ai.model],
              [
                'Key variable',
                ai.keyEnv || (ai.provider === 'openai' ? 'AI_API_KEY' : 'GEMINI_API_KEY'),
              ],
              ['Intake mode', ai.intakeMode],
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
                Add a key on Replit
              </p>
              <ol className="mt-1 space-y-1 text-[10px] text-amber-800/90 dark:text-amber-300/90 list-decimal list-inside leading-relaxed">
                <li>Open your Replit project → <strong>Tools → Secrets</strong>.</li>
                <li>
                  Add <code className="font-mono">{ai.keyEnv || 'GEMINI_API_KEY'}</code>{' '}
                  with your API key.
                </li>
                <li>Restart the Run button (or republish) so the env var loads.</li>
                <li>Return here and click <strong>Test connection</strong>.</li>
              </ol>
              <a
                href="https://docs.replit.com/core-concepts/project-editor/app-setup/secrets"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-200 underline"
              >
                Replit Secrets guide
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
              Test connection
            </button>
            <button
              onClick={handleRefreshAi}
              disabled={isRefreshingAi}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshingAi ? 'animate-spin' : ''}`}
              />
              Refresh status
            </button>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                Where the code talks to AI
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
                Using another provider (OpenAI-compatible)
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
              Keys are read on the server only. Never paste a key into the
              browser or commit <code>.env</code>; use Replit Secrets for the
              deployment.
            </p>
          </div>
        </section>

        {/* Decision rules */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Decision rules
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Transparent thresholds behind every recommendation. These are
            business policy, not model output.
          </p>

          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
            {[
              {
                label: 'Minimum margin',
                value: `${(rules.minMargin * 100).toFixed(0)}%`,
                hint: 'Below this, the order is rejected',
              },
              {
                label: 'Margin warning',
                value: `${(rules.warnMargin * 100).toFixed(0)}%`,
                hint: 'Below this, the margin check warns',
              },
              {
                label: 'High-value review',
                value: `RM ${rules.highValueThreshold.toLocaleString()}`,
                hint: 'Larger orders raise the risk score',
              },
              {
                label: 'Lead-time buffer',
                value: `${rules.leadTimeBufferDays} day(s)`,
                hint: 'Added to supplier lead time',
              },
              {
                label: 'Minimum confidence',
                value: `${(rules.minConfidence * 100).toFixed(0)}%`,
                hint: 'Lower extraction confidence needs review',
              },
            ].map((rule) => (
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
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {rule.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Risk weights · {workspace.industry.name}
            </p>
          </div>
          <div className="mt-2 space-y-2">
            {weightEntries.map(([key, weight]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-600 dark:text-slate-300">
                    {RISK_LABELS[key] || key}
                  </span>
                  <span className="font-semibold text-slate-500">
                    {(weight * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${RISK_COLORS[key] || 'bg-slate-400'}`}
                    style={{ width: `${Math.round(weight * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            Score = Σ (factor score × weight), 0–100. Bands: Low 0–24, Medium
            25–49, High 50–74, Critical 75–100. Hard blockers floor the band so
            a reject or review can never display as low risk.
          </p>
        </section>
      </div>

      {/* Human roles */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Human approval roles
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Use the identity switcher in the top bar. Every confirmation,
          rejection and information request is attributed in the activity log.
        </p>
        <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
          {[
            {
              role: 'Owner',
              can: 'Review every check and approve, reject or request information. Can override a blocker with a written reason.',
              cannot: 'Overrides are still logged with the identity and reason.',
            },
            {
              role: 'Staff',
              can: 'View orders, stock checks, margin, risk factors and the activity log.',
              cannot: 'Cannot confirm, reject or request information.',
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
              Demo data
            </h2>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5 max-w-xl">
              All customers, orders, stock and suppliers are synthetic. Reset
              returns this workspace to its seed; switch industry above for a
              different dataset.
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
            Reset {workspace.industry.name} demo
          </button>
        </div>
      </section>
    </div>
  );
};
