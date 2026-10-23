import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Lock,
  Package,
  ShoppingCart,
  Truck,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  ActivityEvent,
  DecisionInput,
  IndustryProfile,
  Order,
  Recommendation,
  RiskBand,
} from '../types/order';
import { CurrentUser, canApproveOrders } from '../types/user';
import {
  analyzeOrder,
  decideOrder,
  exportCsvUrl,
  exportXlsxUrl,
  fetchOrderActivity,
  recordOrderOutcome,
} from '../services/ordersApi';
import { useI18n } from '../i18n/I18nContext';

interface OrderReviewModalProps {
  order: Order | null;
  industry: IndustryProfile;
  currentUser: CurrentUser;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: (order: Order) => void;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value || 0);

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const recommendationMeta: Record<
  Recommendation,
  { labelKey: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  ACCEPT: {
    labelKey: 'orders.recommendationAccept',
    className:
      'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    Icon: CheckCircle2,
  },
  ACCEPT_WITH_PURCHASE: {
    labelKey: 'orders.recommendationAcceptPurchase',
    className:
      'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    Icon: ShoppingCart,
  },
  REQUEST_INFO: {
    labelKey: 'orders.recommendationRequestInfo',
    className:
      'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    Icon: AlertTriangle,
  },
  REJECT: {
    labelKey: 'orders.recommendationReject',
    className:
      'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200',
    Icon: XCircle,
  },
  NEEDS_REVIEW: {
    labelKey: 'orders.recommendationNeedsReview',
    className:
      'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200',
    Icon: Info,
  },
};

const riskBandMeta: Record<
  RiskBand,
  { className: string; bar: string }
> = {
  Low: {
    className:
      'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    bar: 'bg-emerald-500',
  },
  Medium: {
    className:
      'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    bar: 'bg-amber-500',
  },
  High: {
    className:
      'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200',
    bar: 'bg-orange-500',
  },
  Critical: {
    className:
      'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200',
    bar: 'bg-rose-500',
  },
};

const levelMeta = {
  pass: {
    className: 'text-emerald-700 dark:text-emerald-300',
    Icon: CheckCircle2,
  },
  warn: {
    className: 'text-amber-700 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  fail: {
    className: 'text-rose-700 dark:text-rose-300',
    Icon: XCircle,
  },
};

const orderStatusMeta: Record<string, { labelKey: string; className: string }> = {
  draft: {
    labelKey: 'review.statusDraft',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  analyzed: {
    labelKey: 'review.statusAnalyzed',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  approved: {
    labelKey: 'review.statusApproved',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  rejected: {
    labelKey: 'review.statusRejected',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
  info_requested: {
    labelKey: 'review.statusInfoRequested',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
};

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  order,
  industry,
  currentUser,
  isOpen,
  onClose,
  onOrderUpdated,
}) => {
  const { t, locale } = useI18n();
  const canApprove = canApproveOrders(currentUser);
  const [current, setCurrent] = useState<Order | null>(order);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [note, setNote] = useState('');
  const [override, setOverride] = useState(false);
  const [specialReason, setSpecialReason] = useState<DecisionInput['specialReason']>();
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedReply, setSuggestedReply] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actualOnTime, setActualOnTime] = useState('');
  const [actualProfit, setActualProfit] = useState('');
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCurrent(order);
    setError(null);
    setNote('');
    setOverride(false);
    setSpecialReason(undefined);
    setSuggestedReply(null);
    setActualOnTime(
      order?.actualOutcome?.actualDeliveredOnTime === undefined
        ? ''
        : order.actualOutcome.actualDeliveredOnTime
        ? 'yes'
        : 'no'
    );
    setActualProfit(
      order?.actualOutcome?.actualProfit === undefined
        ? ''
        : String(order.actualOutcome.actualProfit)
    );
  }, [isOpen, order?.id]);

  useEffect(() => {
    if (!isOpen || !current) return;
    fetchOrderActivity(current.id)
      .then(setActivity)
      .catch(() => setActivity([]));
  }, [isOpen, current?.id]);

  const blocked = useMemo(
    () =>
      current?.analysis
        ? current.analysis.recommendation === 'REJECT' ||
          current.analysis.recommendation === 'REQUEST_INFO' ||
          (current.analysis.recommendation === 'NEEDS_REVIEW' &&
            current.analysis.riskBand !== 'Medium')
        : false,
    [current]
  );

  if (!isOpen || !current) return null;

  const analysis = current.analysis;
  const finalized = current.status === 'approved' || current.status === 'rejected';
  const statusMeta = orderStatusMeta[current.status] || orderStatusMeta.draft;
  const riskBand: RiskBand = analysis?.riskBand ?? 'Low';
  const riskMeta = riskBandMeta[riskBand];

  const refreshActivity = async () => {
    setActivity(await fetchOrderActivity(current.id));
  };

  const handleAnalyze = async () => {
    setIsWorking(true);
    setError(null);
    try {
      const updated = await analyzeOrder(current.id);
      setCurrent(updated);
      onOrderUpdated(updated);
      await refreshActivity();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('review.analysisFailed'));
    } finally {
      setIsWorking(false);
    }
  };

  const handleDecision = async (
    decision: 'approve' | 'reject' | 'request_info'
  ) => {
    if (!canApprove) return;
    setIsWorking(true);
    setError(null);
    try {
      const result = await decideOrder(current.id, {
        decision,
        actor: currentUser.name,
        role: currentUser.role,
        note,
        override,
        specialReason,
      });
      setCurrent(result.order);
      onOrderUpdated(result.order);
      setSuggestedReply(result.suggestedReply || null);
      await refreshActivity();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('review.decisionFailed'));
    } finally {
      setIsWorking(false);
    }
  };

  const handleSaveOutcome = async () => {
    if (!current) return;
    const outcome: { actualDeliveredOnTime?: boolean; actualProfit?: number } = {};
    if (actualOnTime) outcome.actualDeliveredOnTime = actualOnTime === 'yes';
    if (actualProfit.trim()) outcome.actualProfit = Number(actualProfit);
    if (!Object.keys(outcome).length || Object.values(outcome).some((value) => value === undefined || (typeof value === 'number' && !Number.isFinite(value)))) {
      setError(t('review.outcomeRequired'));
      return;
    }
    setIsSavingOutcome(true);
    setError(null);
    try {
      const updated = await recordOrderOutcome(current.id, outcome);
      setCurrent(updated);
      onOrderUpdated(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('review.outcomeSaveError'));
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const handleCopy = async () => {
    if (!suggestedReply) return;
    await navigator.clipboard.writeText(suggestedReply);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {current.id}
              </h2>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusMeta.className}`}
              >
                {t(statusMeta.labelKey)}
              </span>
              {current.analysis && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {current.analysis.daysUntilDelivery !== null
                    ? t('review.daysToDelivery', {
                        count: current.analysis.daysUntilDelivery,
                      })
                    : t('review.noDeliveryDate')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {current.customerName}
              {current.contact ? ` · ${current.contact}` : ''} · from{' '}
              {current.messageId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label={t('review.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!analysis ? (
            <div className="text-center py-10 space-y-3">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t('review.notAnalysed')}
              </p>
              <button
                onClick={handleAnalyze}
                disabled={isWorking}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {isWorking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {t('review.runChecks')}
              </button>
            </div>
          ) : (
            <>
              {/* Recommendation */}
              {(() => {
                const meta = recommendationMeta[analysis.recommendation];
                return (
                  <div className={`rounded-2xl border p-4 ${meta.className}`}>
                    <div className="flex items-start gap-3">
                      <meta.Icon className="w-5 h-5 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold">
                            {t('review.systemRecommendation', {
                              label: t(meta.labelKey),
                            })}
                          </p>
                          <span className="text-[10px] font-medium opacity-80">
                            {t('review.extractionConfidence', {
                              value: pct(analysis.confidence),
                            })}
                          </span>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs leading-relaxed">
                          {analysis.reasons.map((reason, index) => (
                            <li key={index}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {analysis.responseActions && analysis.responseActions.length > 0 && (
                <section className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20 p-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-200 mb-2">
                    {t('review.responsePlan')}
                  </h3>
                  <ul className="space-y-2">
                    {analysis.responseActions.map((action, index) => (
                      <li key={`${action.strategy}-${index}`} className="text-[11px] text-slate-700 dark:text-slate-300">
                        <strong className="uppercase text-[9px] tracking-wide text-sky-700 dark:text-sky-300">
                          {action.strategy}
                        </strong>
                        <span className="ml-2">{action.action}</span>
                        {action.suggestedReply && (
                          <p className="mt-0.5 ml-1 text-slate-500 dark:text-slate-400">
                            “{action.suggestedReply}”
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Industry fields + transparent risk score */}
              <section className="grid lg:grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    {t('review.orderDetails', { industry: industry.name })}
                  </h3>
                  <dl className="grid grid-cols-2 gap-2">
                    {industry.fields.map((field) => {
                      const value = current.industryFields?.[field.key];
                      return (
                        <div
                          key={field.key}
                          className="rounded-lg bg-slate-50 dark:bg-slate-800/40 px-2.5 py-1.5"
                        >
                          <dt className="text-[9px] uppercase tracking-wider text-slate-400">
                            {field.label}
                            {field.required ? ' *' : ''}
                          </dt>
                          <dd
                            className={`text-[11px] font-medium mt-0.5 break-words ${
                              value
                                ? 'text-slate-700 dark:text-slate-300'
                                : field.required
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {value || (field.required ? t('review.missing') : '—')}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <p className="text-[10px] text-slate-400 mt-2">
                    {t('review.extractedBy', {
                      method:
                        current.extractionMethod === 'ai'
                          ? t('orders.ai')
                          : t('review.ruleEngine'),
                      source: t(`source.${current.source}`),
                    })}
                  </p>
                </div>

                <div className={`rounded-xl border p-3.5 ${riskMeta.className}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider opacity-70">
                        {t('review.riskScore')}
                      </h3>
                      <p className="text-2xl font-extrabold mt-0.5">
                        {Math.round(analysis.riskScore)}
                        <span className="text-xs font-semibold opacity-60">
                          /100 · {t(`orders.risk${riskBand}`)}
                        </span>
                      </p>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider border border-current/30 rounded-full px-2 py-0.5 opacity-80">
                      {t('review.weighted')}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {analysis.riskFactors.map((factor) => (
                      <div key={factor.key} title={factor.detail}>
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="font-medium truncate">
                            {factor.label}
                          </span>
                          <span className="opacity-70 whitespace-nowrap">
                            {Math.round(factor.score)} ×{' '}
                            {(factor.weight * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 mt-0.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${riskMeta.bar}`}
                            style={{ width: `${Math.max(2, Math.min(100, factor.score))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] opacity-70 mt-2 leading-relaxed">
                    {t('review.scoreFormula')}
                    {analysis.rawRiskScore !== undefined &&
                    Math.round(analysis.rawRiskScore) !==
                      Math.round(analysis.riskScore)
                      ? t('review.rawScore', { score: Math.round(analysis.rawRiskScore) })
                      : ''}
                  </p>
                </div>
              </section>

              {/* Checks */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {t('review.decisionChecks')}
                </h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {analysis.checks.map((check) => {
                    const meta = levelMeta[check.level];
                    return (
                      <div
                        key={check.code}
                        className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2.5"
                      >
                        <meta.Icon
                          className={`w-4 h-4 shrink-0 mt-0.5 ${meta.className}`}
                        />
                        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                          {check.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Stock per line */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {t('review.stockReplenishment', {
                    stock: t(
                      industry.inventoryMode === 'capacity'
                        ? 'inventory.capacity'
                        : industry.inventoryMode === 'material'
                        ? 'inventory.material'
                        : 'inventory.stock'
                    ),
                  })}
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[720px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-3">{t('review.item')}</th>
                        <th className="py-2 px-3 text-right">{t('review.need')}</th>
                        <th className="py-2 px-3 text-right">{t('review.available')}</th>
                        <th className="py-2 px-3 text-right">{t('review.shortfall')}</th>
                        <th className="py-2 px-3">{t('review.supplierLead')}</th>
                        <th className="py-2 px-3 text-right">{t('review.purchaseDraft')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analysis.stock.map((line) => (
                        <tr key={line.sku}>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {line.name}
                            </p>
                            <p className="text-[10px] text-slate-400">{line.sku}</p>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {line.required}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {line.available}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-semibold ${
                              line.shortfall > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {line.shortfall}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-medium text-slate-700 dark:text-slate-300">
                              {line.supplierName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {t('catalog.days', { count: line.leadTimeDays })} ·{' '}
                              {line.canReplenishInTime
                                ? t('review.inTime')
                                : t('review.tooLate')}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {line.shortfall > 0 ? (
                              <>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">
                                  {line.suggestedPurchaseQty} @ {money(line.unitCost)}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {money(line.purchaseCost)}
                                </p>
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {industry.inventoryMode === 'capacity'
                    ? t('review.availableCapacity')
                    : industry.inventoryMode === 'material'
                    ? t('review.availableMaterial')
                    : t('review.availableStock')}
                </p>
              </section>

              {/* Financials */}
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  [t('review.revenue'), money(analysis.revenue)],
                  [t('review.productCost'), money(analysis.cost)],
                  [t('review.grossProfit'), money(analysis.profit)],
                  [t('review.grossMargin'), pct(analysis.margin)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      {label}
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {value}
                    </p>
                  </div>
                ))}
              </section>

              {/* Purchase drafts */}
              {current.purchaseDrafts.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    {t('review.purchaseDraftsCreated')}
                  </h3>
                  <div className="space-y-2">
                    {current.purchaseDrafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-blue-800 dark:text-blue-200">
                            {draft.id} · {draft.supplierName}
                          </p>
                          <p className="text-xs font-bold text-blue-800 dark:text-blue-200">
                            {money(draft.totalCost)}
                          </p>
                        </div>
                        <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-1">
                          {t('review.expectedStatus', {
                            date: draft.expectedDate,
                            status: draft.status,
                          })}
                        </p>
                        <ul className="mt-1.5 space-y-0.5">
                          {draft.items.map((item) => (
                            <li
                              key={item.sku}
                              className="text-[11px] text-blue-700/80 dark:text-blue-300/80"
                            >
                              {item.quantity} × {item.name} @ {money(item.unitCost)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Suggested reply */}
              {suggestedReply && (
                <section className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-xs font-bold text-amber-800 dark:text-amber-200">
                      {t('review.suggestedReply')}
                    </h3>
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/70 dark:bg-slate-900/60 border border-amber-200 dark:border-amber-900 text-[10px] font-semibold text-amber-800 dark:text-amber-200 hover:bg-white"
                    >
                      <Copy className="w-3 h-3" />
                      {copied ? t('review.copied') : t('review.copy')}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={suggestedReply}
                    rows={3}
                    className="w-full text-xs rounded-lg border border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-900 p-2 text-slate-700 dark:text-slate-300"
                  />
                </section>
              )}

              {/* Human decision */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  {t('review.humanApproval')}
                </h3>

                {finalized ? (
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      <strong>{t('review.decision')}</strong>{' '}
                      {current.approval?.decision === 'approve'
                        ? t('review.decisionApprove')
                        : current.approval?.decision === 'reject'
                        ? t('review.decisionReject')
                        : t('review.decisionRequestInfo')}
                    </p>
                    <p>
                      <strong>{t('review.by')}</strong> {current.approval?.actor} (
                      {current.approval?.role === 'owner'
                        ? t('header.owner')
                        : t('header.staff')})
                    </p>
                    {current.approval?.note && (
                      <p>
                        <strong>{t('review.note')}</strong> {current.approval.note}
                      </p>
                    )}
                    {current.approval?.specialReason && (
                      <p>
                        <strong>{t('review.specialReason')}</strong>{' '}
                        {t(`review.specialReason.${current.approval.specialReason}`)}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      {t('review.recorded', {
                        date: current.approval?.decidedAt
                          ? new Date(current.approval.decidedAt).toLocaleString(locale)
                          : '—',
                      })}
                    </p>
                  </div>
                ) : !canApprove ? (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Lock className="w-3.5 h-3.5" />
                      {t('review.viewOnlyTitle', { name: currentUser.name })}
                    </div>
                    <p className="text-[11px] opacity-80 mt-1 leading-relaxed">
                      {t('review.viewOnlyBody')}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-200">
                      <UserCheck className="w-3.5 h-3.5" />
                      {t('review.actingAs', { name: currentUser.name })}
                    </div>

                    <label className="block mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {t('review.decisionNote')}
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={2}
                        placeholder={t('review.decisionPlaceholder')}
                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400"
                      />
                      {analysis.recommendation === 'NEEDS_REVIEW' &&
                        analysis.riskBand === 'Medium' && (
                          <span className="block mt-1 text-amber-700 dark:text-amber-300">
                            {t('review.mediumRiskNoteRequired')}
                          </span>
                        )}
                    </label>

                    {blocked && (
                      <div className="mt-3 space-y-2">
                        <label className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-300">
                          <input
                            type="checkbox"
                            checked={override}
                            disabled={analysis.complianceBlocked}
                            onChange={(event) => setOverride(event.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            {t('review.override', {
                              recommendation: t(
                                recommendationMeta[analysis.recommendation].labelKey
                              ),
                            })}
                          </span>
                        </label>
                        {override && (
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400">
                            {t('review.specialReason')}
                            <select
                              value={specialReason || ''}
                              onChange={(event) =>
                                setSpecialReason(
                                  (event.target.value || undefined) as DecisionInput['specialReason']
                                )
                              }
                              required
                              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200"
                            >
                              <option value="">{t('review.specialReason.select')}</option>
                              <option value="strategic_customer">{t('review.specialReason.strategic_customer')}</option>
                              <option value="clear_inventory">{t('review.specialReason.clear_inventory')}</option>
                              <option value="new_process">{t('review.specialReason.new_process')}</option>
                              <option value="other">{t('review.specialReason.other')}</option>
                            </select>
                          </label>
                        )}
                      </div>
                    )}

                    <p className="mt-2 text-[10px] text-slate-400">
                      {t('review.attributed', { name: currentUser.name })}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleDecision('approve')}
                        disabled={
                          isWorking ||
                          (override && !specialReason) ||
                          Boolean(analysis.complianceBlocked) ||
                          (analysis.recommendation === 'NEEDS_REVIEW' &&
                            analysis.riskBand === 'Medium' &&
                            !note.trim())
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('review.approve')}
                      </button>
                      <button
                        onClick={() => handleDecision('request_info')}
                        disabled={isWorking}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-60"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {t('review.requestInfo')}
                      </button>
                      <button
                        onClick={() => handleDecision('reject')}
                        disabled={isWorking}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-60"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t('review.reject')}
                      </button>
                      {isWorking && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t('review.recording')}
                        </span>
                      )}
                    </div>
                  </>
                )}
                {finalized && current.status === 'approved' && (
                  <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {t('review.actualOutcome')}
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-2 mt-2">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('review.deliveredOnTime')}
                        <select
                          value={actualOnTime}
                          onChange={(event) => setActualOnTime(event.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                        >
                          <option value="">{t('review.selectOutcome')}</option>
                          <option value="yes">{t('review.yes')}</option>
                          <option value="no">{t('review.no')}</option>
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('review.actualProfit')}
                        <input
                          type="number"
                          step="0.01"
                          value={actualProfit}
                          onChange={(event) => setActualProfit(event.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveOutcome}
                      disabled={isSavingOutcome}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-semibold disabled:opacity-60"
                    >
                      {isSavingOutcome && <Loader2 className="w-3 h-3 animate-spin" />}
                      {t('review.saveOutcome')}
                    </button>
                  </div>
                )}
              </section>

              {/* Activity */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {t('review.activity')}
                </h3>
                <div className="space-y-1.5">
                  {activity.length === 0 ? (
                    <p className="text-xs text-slate-400">{t('review.noEvents')}</p>
                  ) : (
                    activity.map((event) => (
                      <div
                        key={event.id}
                        className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 text-[11px] border-b border-slate-100 dark:border-slate-800 pb-1.5"
                      >
                        <span className="text-slate-400 shrink-0 w-36">
                          {new Date(event.ts).toLocaleString(locale)}
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                          {event.action}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {event.details}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <a
              href={exportXlsxUrl()}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </a>
            <a
              href={exportCsvUrl()}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </a>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
