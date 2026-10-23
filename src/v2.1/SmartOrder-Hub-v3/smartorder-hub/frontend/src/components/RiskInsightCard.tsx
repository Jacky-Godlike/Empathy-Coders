import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Order, RiskInsight } from '../types/order';
import { useI18n } from '../i18n/I18nContext';
import { fetchRiskInsight } from '../services/riskApi';

interface RiskInsightCardProps {
  orders: Order[];
  className?: string;
}

export const RiskInsightCard: React.FC<RiskInsightCardProps> = ({
  orders,
  className = '',
}) => {
  const { language, t } = useI18n();
  const [insight, setInsight] = useState<RiskInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const signature = useMemo(
    () =>
      orders
        .map(
          (order) =>
            `${order.id}:${Math.round(order.analysis?.riskScore ?? -1)}`
        )
        .join('|'),
    [orders]
  );

  useEffect(() => {
    if (!orders.length) {
      setInsight(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchRiskInsight(language)
      .then((data) => {
        if (!cancelled) setInsight(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t('orders.aiRiskError')
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [signature, language, refreshNonce, orders.length, t]);

  const topRisks = insight?.topRisks.slice(0, 2) ?? [];

  return (
    <section
      className={`rounded-xl border border-violet-200 dark:border-violet-900/70 bg-white dark:bg-slate-900 p-3.5 flex flex-col ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              {t('orders.aiRiskBrief')}
            </h3>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {t('orders.aiRiskBriefSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshNonce((value) => value + 1)}
          disabled={isLoading}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          title={t('orders.aiRiskRefresh')}
          aria-label={t('orders.aiRiskRefresh')}
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {topRisks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {topRisks.map((risk, index) => (
            <span
              key={risk.key}
              className="inline-flex items-center gap-1 rounded-full border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 text-[9px] font-semibold text-violet-800 dark:text-violet-200"
            >
              <span className="w-3 h-3 rounded-full bg-violet-600 text-white text-[7px] font-bold flex items-center justify-center">
                {index + 1}
              </span>
              {risk.label}
              <span className="opacity-70">
                {Math.round(risk.share * 100)}%
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex-1">
        {isLoading && !insight ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-2.5 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-2.5 rounded bg-slate-100 dark:bg-slate-800 w-11/12" />
            <div className="h-2.5 rounded bg-slate-100 dark:bg-slate-800 w-4/5" />
            <p className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t('orders.aiRiskAnalyzing')}
            </p>
          </div>
        ) : error && !insight ? (
          <div className="text-[10px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : insight ? (
          <>
            <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              {insight.summary}
            </p>
            {insight.suggestions.length > 0 && (
              <ul className="mt-2 space-y-1">
                {insight.suggestions.slice(0, 3).map((suggestion, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300"
                  >
                    <Lightbulb className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-[10px] text-slate-400">
            {t('orders.aiRiskEmpty')}
          </p>
        )}
      </div>

      {insight && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">
            {insight.generatedBy === 'ai'
              ? t('orders.aiRiskAiBy', {
                  provider: insight.providerLabel,
                })
              : t('orders.aiRiskRules')}
          </p>
          {insight.aiError && (
            <p className="text-[9px] text-amber-700 dark:text-amber-300 mt-0.5">
              {t('orders.aiRiskFallback')}
            </p>
          )}
          {!insight.aiConfigured && (
            <p className="text-[9px] text-slate-400 mt-0.5">
              {t('orders.aiRiskNoKey')}
            </p>
          )}
          <p className="text-[9px] text-slate-400 mt-1">
            {t('orders.aiRiskDisclaimer')}
          </p>
        </div>
      )}
    </section>
  );
};
