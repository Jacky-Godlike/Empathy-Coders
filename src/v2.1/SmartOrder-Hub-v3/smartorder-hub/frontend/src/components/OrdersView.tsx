import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FilterX,
  Inbox,
  Loader2,
  Lock,
  Package,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import {
  IndustryProfile,
  IntakeSummary,
  Order,
  Recommendation,
  RiskBand,
} from '../types/order';
import {
  decideOrder,
  exportCsvUrl,
  exportXlsxUrl,
  fetchIntakeSummary,
  fetchOrders,
  processIntake,
} from '../services/ordersApi';
import { RiskPieChart } from './RiskPieChart';
import { RiskTypePieChart } from './RiskTypePieChart';
import { RiskInsightCard } from './RiskInsightCard';
import { CurrentUser, canApproveOrders } from '../types/user';
import { useI18n } from '../i18n/I18nContext';

type Translate = (
  key: string,
  vars?: Record<string, string | number>
) => string;

interface OrdersViewProps {
  industry: IndustryProfile;
  mode: 'desk' | 'records';
  currentUser: CurrentUser;
  onOpenOrder: (order: Order) => void;
  refreshKey?: number;
  onDataChanged?: () => void;
}

type Filter = 'pending' | 'all' | 'approved' | 'info' | 'rejected';

const money = (value: number) =>
  new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value || 0);

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const recommendationStyle: Record<Recommendation, string> = {
  ACCEPT:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  ACCEPT_WITH_PURCHASE:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  REQUEST_INFO:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  REJECT:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  NEEDS_REVIEW:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const riskStyle: Record<RiskBand, string> = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  Medium:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  High:
    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
  Critical:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
};

const sourceStyle: Record<string, string> = {
  whatsapp:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  facebook:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  instagram:
    'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-900',
  telegram:
    'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900',
  tiktok:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  email:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  manual:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

function stockBadge(order: Order, industry: IndustryProfile, t: Translate) {
  const lines = order.analysis?.stock ?? [];
  const stockLabel = t(
    industry.inventoryMode === 'capacity'
      ? 'inventory.capacity'
      : industry.inventoryMode === 'material'
      ? 'inventory.material'
      : 'inventory.stock'
  );
  const title = lines
    .map(
      (line) =>
        `${line.name}: ${t('review.need')} ${line.required}, ${t('review.available')} ${line.available}, ${t('review.shortfall')} ${line.shortfall}`
    )
    .join('\n');

  if (!lines.length) {
    return {
      label: t('orders.stockNoCheck', { stock: stockLabel.toLowerCase() }),
      className:
        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      title: t('orders.stockRun'),
    };
  }

  const short = lines.filter((line) => line.shortfall > 0);
  if (short.some((line) => !line.canReplenishInTime)) {
    return {
      label: t('orders.stockCannotMeet'),
      className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      title,
    };
  }
  if (short.length > 0) {
    return {
      label:
        industry.inventoryMode === 'capacity'
          ? t('orders.stockCapacityShort')
          : industry.inventoryMode === 'material'
          ? t('orders.stockMaterialShort')
          : t('orders.stockItemsShort', { count: short.length }),
      className:
        'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      title,
    };
  }
  return {
    label:
      industry.inventoryMode === 'capacity'
        ? t('orders.stockCapacityOk')
        : industry.inventoryMode === 'material'
        ? t('orders.stockMaterialReady')
        : t('orders.stockInStock'),
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    title,
  };
}

const StatCard: React.FC<{
  label: string;
  value: number | string;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: 'blue' | 'amber' | 'slate' | 'emerald';
}> = ({ label, value, hint, Icon, tone = 'slate' }) => {
  const toneStyle =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <span className={`p-1.5 rounded-lg ${toneStyle}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 truncate">
        {value}
      </p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
};

export const OrdersView: React.FC<OrdersViewProps> = ({
  industry,
  mode,
  currentUser,
  onOpenOrder,
  refreshKey = 0,
  onDataChanged,
}) => {
  const { t } = useI18n();
  const canApprove = canApproveOrders(currentUser);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<IntakeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(
    mode === 'desk' ? 'pending' : 'all'
  );

  useEffect(() => {
    setFilter(mode === 'desk' ? 'pending' : 'all');
  }, [mode, industry.id]);

  const refresh = useCallback(
    async (processNew: boolean) => {
      setIsLoading(true);
      setError(null);
      try {
        if (processNew && mode === 'desk') {
          const before = await fetchIntakeSummary();
          if (before.unprocessed > 0) {
            setIsProcessing(true);
            const result = await processIntake();
            setNotice(
              t('orders.intakeComplete', {
                processed: result.processed,
                orders: result.ordersCreated,
                filtered: result.processed - result.ordersCreated,
              })
            );
            setIsProcessing(false);
          }
        }

        const [ordersData, summaryData] = await Promise.all([
          fetchOrders(),
          fetchIntakeSummary(),
        ]);
        setOrders(ordersData);
        setSummary(summaryData);
        onDataChanged?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('orders.loadError'));
      } finally {
        setIsLoading(false);
        setIsProcessing(false);
      }
    },
    [mode, onDataChanged, t]
  );

  useEffect(() => {
    refresh(mode === 'desk');
  }, [refresh, refreshKey, mode]);

  const counts = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === 'analyzed').length,
      approved: orders.filter((order) => order.status === 'approved').length,
      info: orders.filter((order) => order.status === 'info_requested').length,
      rejected: orders.filter((order) => order.status === 'rejected').length,
      all: orders.length,
    }),
    [orders]
  );

  const sortedOrders = useMemo(() => {
    const recommendationPriority: Record<string, number> = {
      ACCEPT_WITH_PURCHASE: 0,
      ACCEPT: 1,
      NEEDS_REVIEW: 2,
      REQUEST_INFO: 3,
      REJECT: 4,
    };
    const statusPriority: Record<string, number> = {
      analyzed: 0,
      draft: 1,
      info_requested: 2,
      approved: 3,
      rejected: 4,
    };

    return [...orders].sort((a, b) => {
      const statusA = statusPriority[a.status] ?? 5;
      const statusB = statusPriority[b.status] ?? 5;
      if (statusA !== statusB) return statusA - statusB;

      const recA =
        recommendationPriority[a.analysis?.recommendation ?? 'NEEDS_REVIEW'] ?? 5;
      const recB =
        recommendationPriority[b.analysis?.recommendation ?? 'NEEDS_REVIEW'] ?? 5;
      if (recA !== recB) return recA - recB;

      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [orders]);

  const visibleOrders = useMemo(() => {
    if (filter === 'pending') {
      return sortedOrders.filter((order) => order.status === 'analyzed');
    }
    if (filter === 'approved') {
      return sortedOrders.filter((order) => order.status === 'approved');
    }
    if (filter === 'info') {
      return sortedOrders.filter((order) => order.status === 'info_requested');
    }
    if (filter === 'rejected') {
      return sortedOrders.filter((order) => order.status === 'rejected');
    }
    return sortedOrders;
  }, [sortedOrders, filter]);

  const tableFields = useMemo(
    () => industry.fields.filter((field) => field.table),
    [industry]
  );

  const recordStats = useMemo(() => {
    const approved = orders.filter((order) => order.status === 'approved');
    return {
      approved: approved.length,
      drafts: approved.reduce(
        (total, order) => total + order.purchaseDrafts.length,
        0
      ),
      info: orders.filter((order) => order.status === 'info_requested').length,
      value: approved.reduce(
        (total, order) => total + (order.analysis?.revenue ?? 0),
        0
      ),
    };
  }, [orders]);

  const handleConfirm = async (order: Order) => {
    if (!canApprove) return;
    setActionId(order.id);
    setError(null);
    try {
      const result = await decideOrder(order.id, {
        decision: 'approve',
        actor: currentUser.name,
        role: currentUser.role,
        note: t('orders.confirmNote', {
          name: currentUser.name,
          role: currentUser.role === 'owner' ? t('header.owner') : t('header.staff'),
        }),
      });
      setOrders((prev) =>
        prev.map((item) => (item.id === result.order.id ? result.order : item))
      );
      setSummary(await fetchIntakeSummary());
      onDataChanged?.();
      const drafts = result.order.purchaseDrafts.length;
      setNotice(
        t('orders.confirmSuccess', {
          id: result.order.id,
          drafts: drafts
            ? t('orders.draftsCreated', { count: drafts })
            : '',
        })
      );
      // Keep the confirmed row visible instead of making it disappear from the queue.
      setFilter('all');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('orders.confirmError'));
    } finally {
      setActionId(null);
    }
  };

  const filterOptions: [Filter, string][] =
    mode === 'desk'
      ? [
          ['pending', t('orders.filterPending', { count: counts.pending })],
          ['all', t('orders.filterAll', { count: counts.all })],
          ['approved', t('orders.filterApproved', { count: counts.approved })],
          ['info', t('orders.filterInfo', { count: counts.info })],
          ['rejected', t('orders.filterRejected', { count: counts.rejected })],
        ]
      : [
          ['all', t('orders.filterAllRecords', { count: counts.all })],
          ['approved', t('orders.filterApproved', { count: counts.approved })],
          ['info', t('orders.filterInfo', { count: counts.info })],
          ['rejected', t('orders.filterRejected', { count: counts.rejected })],
        ];

  return (
    <div className="space-y-4">
      {/* Header and actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {mode === 'desk' ? (
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {mode === 'desk' ? t('orders.deskTitle') : t('orders.recordsTitle')}
            </h2>
            <span
              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                canApprove
                  ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
              }`}
            >
              {canApprove ? t('orders.ownerApproval') : t('orders.viewOnly')}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
            {mode === 'desk' ? t('orders.deskSubtitle') : t('orders.recordsSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => refresh(mode === 'desk')}
            disabled={isLoading || isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading || isProcessing ? 'animate-spin' : ''}`}
            />
            {t('orders.refresh')}
          </button>
          <a
            href={exportXlsxUrl()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {t('orders.excel')}
          </a>
          <a
            href={exportCsvUrl()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100"
          >
            <Download className="w-3.5 h-3.5" />
            {t('orders.csv')}
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isProcessing && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{t('orders.intakeRunning')}</span>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="p-0.5 rounded hover:opacity-70"
            aria-label={t('common.close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {mode === 'desk' && !canApprove && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              {t('orders.viewOnlyTitle', { name: currentUser.name })}
            </p>
            <p className="text-[11px] opacity-80 mt-0.5">
              {t('orders.viewOnlyBody')}
            </p>
          </div>
        </div>
      )}

      {/* Summary cards + risk mix */}
      {mode === 'desk' ? (
        <div className="space-y-2.5">
          <div className="grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
            <RiskPieChart orders={orders} />
            <RiskTypePieChart orders={orders} />
            <RiskInsightCard
              orders={orders}
              className="lg:col-span-2 2xl:col-span-1"
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <StatCard
              label={t('orders.messagesScanned')}
              value={summary?.totalMessages ?? '—'}
              hint={t('orders.messagesScannedHint')}
              Icon={Inbox}
              tone="slate"
            />
            <StatCard
              label={t('orders.ordersDetected')}
              value={summary?.orders ?? '—'}
              hint={t('orders.ordersDetectedHint')}
              Icon={ClipboardList}
              tone="blue"
            />
            <StatCard
              label={t('orders.filteredOut')}
              value={summary ? summary.totalMessages - summary.orders : '—'}
              hint={t('orders.filteredOutHint')}
              Icon={FilterX}
              tone="slate"
            />
            <StatCard
              label={t('orders.awaitingConfirmation')}
              value={summary?.awaitingConfirmation ?? '—'}
              hint={t('orders.awaitingConfirmationHint')}
              Icon={Clock}
              tone="amber"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatCard
            label={t('orders.approvedOrders')}
            value={recordStats.approved}
            hint={t('orders.approvedOrdersHint')}
            Icon={CheckCircle2}
            tone="emerald"
          />
          <StatCard
            label={t('orders.purchaseDrafts')}
            value={recordStats.drafts}
            hint={t('orders.purchaseDraftsHint')}
            Icon={ShoppingCart}
            tone="blue"
          />
          <StatCard
            label={t('orders.awaitingInfo')}
            value={recordStats.info}
            hint={t('orders.awaitingInfoHint')}
            Icon={Clock}
            tone="amber"
          />
          <StatCard
            label={t('orders.approvedValue')}
            value={money(recordStats.value)}
            hint={t('orders.approvedValueHint')}
            Icon={Package}
            tone="slate"
          />
        </div>
      )}

      {summary && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {t('orders.autoClassified', {
            processed: summary.processedMessages,
            total: summary.totalMessages,
            orders: summary.byType.order ?? 0,
            inquiries: summary.byType.inquiry ?? 0,
            ads: summary.byType.ad ?? 0,
            afterSales: summary.byType.after_sales ?? 0,
            other: summary.byType.other ?? 0,
            uncertain: summary.byType.uncertain ?? 0,
          })}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {filterOptions.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
              filter === key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800/60 animate-pulse"
            />
          ))}
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {filter === 'pending' && counts.all > 0
              ? t('orders.emptyCaughtUp')
              : mode === 'records' && counts.all === 0
              ? t('orders.emptyNoRecords')
              : t('orders.emptyFilter')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filter === 'pending' && counts.all > 0
              ? t('orders.emptyCaughtUpBody')
              : mode === 'records' && counts.all === 0
              ? t('orders.emptyNoRecordsBody')
              : t('orders.emptyFilterBody')}
          </p>
          {filter !== 'all' && counts.all > 0 && (
            <button
              onClick={() => setFilter('all')}
              className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            >
              {t('orders.viewAll')}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table
            className={`w-full text-xs text-left ${
              mode === 'records' ? 'min-w-[1680px]' : 'min-w-[1510px]'
            }`}
          >
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 font-semibold">{t('orders.colOrder')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('orders.colSource')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('orders.colCustomer')}</th>
                <th className="py-2.5 px-3 font-semibold">
                  {t('orders.colItems')}
                </th>
                {tableFields.length > 0 && (
                  <th className="py-2.5 px-3 font-semibold">
                    {t('orders.colDetails')}
                  </th>
                )}
                <th className="py-2.5 px-3 font-semibold text-right">{t('orders.colTotal')}</th>
                <th className="py-2.5 px-3 font-semibold">
                  {t('orders.colDelivery')}
                </th>
                <th className="py-2.5 px-3 font-semibold">
                  {t(
                    industry.inventoryMode === 'capacity'
                      ? 'inventory.capacity'
                      : industry.inventoryMode === 'material'
                      ? 'inventory.material'
                      : 'inventory.stock'
                  )}
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">{t('orders.colMargin')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('orders.colRisk')}</th>
                <th className="py-2.5 px-3 font-semibold">{t('orders.colRecommendation')}</th>
                {mode === 'records' && (
                  <th className="py-2.5 px-3 font-semibold">{t('orders.colPurchases')}</th>
                )}
                <th className="py-2.5 px-3 font-semibold text-right sticky right-0 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">
                  {t('orders.colAction')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleOrders.map((order) => {
                const analysis = order.analysis;
                const recommendation = analysis?.recommendation;
                const canConfirm =
                  canApprove &&
                  mode === 'desk' &&
                  order.status === 'analyzed' &&
                  (recommendation === 'ACCEPT' ||
                    recommendation === 'ACCEPT_WITH_PURCHASE');
                const stock = stockBadge(order, industry, t);
                const margin = analysis?.margin ?? 0;
                const band: RiskBand = analysis?.riskBand ?? 'Low';
                const riskTitle =
                  analysis?.riskFactors
                    ?.map(
                      (factor) =>
                        `${factor.label}: ${factor.score}/100 × ${(
                          factor.weight * 100
                        ).toFixed(0)}% = ${factor.weighted.toFixed(1)}`
                    )
                    .join('\n') || t('orders.noRiskFactors');
                const highRisk =
                  Boolean(analysis) &&
                  (band === 'High' || band === 'Critical');
                const detailValues = tableFields
                  .map((field) => ({
                    field,
                    value: order.industryFields?.[field.key],
                  }))
                  .filter((entry) => Boolean(entry.value));
                const missingRequired = tableFields.filter(
                  (field) =>
                    field.required && !order.industryFields?.[field.key]
                );

                return (
                  <tr
                    key={order.id}
                    onClick={() => onOpenOrder(order)}
                    className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition align-top"
                  >
                    <td className="py-3 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {order.id}
                      <p className="text-[10px] font-sans font-normal text-slate-400 mt-0.5">
                        {order.messageId}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold capitalize ${
                          sourceStyle[order.source] || sourceStyle.manual
                        }`}
                      >
                        {t(`source.${order.source}`)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {order.customerName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {order.contact || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        {order.items.map((item) => (
                          <p
                            key={`${order.id}-${item.sku}`}
                            className="text-slate-700 dark:text-slate-300 whitespace-nowrap"
                          >
                            <span className="font-semibold">
                              {item.quantity}×
                            </span>{' '}
                            {item.name}
                          </p>
                        ))}
                      </div>
                    </td>
                    {tableFields.length > 0 && (
                      <td className="py-3 px-3">
                        {detailValues.length === 0 && missingRequired.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="space-y-0.5 max-w-[230px]">
                            {detailValues.slice(0, 3).map(({ field, value }) => (
                              <p
                                key={field.key}
                                className="text-[10px] text-slate-600 dark:text-slate-300"
                              >
                                <span className="text-slate-400">
                                  {field.label}:
                                </span>{' '}
                                <span
                                  className="font-medium break-words"
                                  title={value}
                                >
                                  {value}
                                </span>
                              </p>
                            ))}
                            {detailValues.length > 3 && (
                              <p
                                className="text-[10px] text-slate-400"
                                title={detailValues
                                  .slice(3)
                                  .map(
                                    ({ field, value }) =>
                                      `${field.label}: ${value}`
                                  )
                                  .join('\n')}
                              >
                                {t('orders.moreDetails', { count: detailValues.length - 3 })}
                              </p>
                            )}
                            {missingRequired.map((field) => (
                              <p
                                key={`missing-${field.key}`}
                                className="text-[10px] font-semibold text-rose-600 dark:text-rose-400"
                              >
                                {t('orders.stockMissing', { field: field.label })}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="py-3 px-3 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {analysis ? money(analysis.revenue) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {order.requestedDeliveryDate || t('orders.noDate')}
                      </p>
                      <p
                        className="text-[10px] text-slate-400 max-w-[190px] truncate"
                        title={order.deliveryAddress}
                      >
                        {order.deliveryAddress || t('orders.noAddress')}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${stock.className}`}
                        title={stock.title}
                      >
                        {stock.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold whitespace-nowrap">
                      {analysis ? (
                        <span
                          className={
                            margin < 0.15
                              ? 'text-rose-600 dark:text-rose-400'
                              : margin < 0.2
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {pct(margin)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {analysis ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${riskStyle[band]}`}
                          title={riskTitle}
                        >
                          <ShieldAlert className="w-2.5 h-2.5" />
                          {t(`orders.risk${band}`)} · {Math.round(analysis.riskScore)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {recommendation ? (
                        <>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${recommendationStyle[recommendation]}`}
                          >
                            {t(
                              recommendation === 'ACCEPT'
                                ? 'orders.recommendationAccept'
                                : recommendation === 'ACCEPT_WITH_PURCHASE'
                                ? 'orders.recommendationAcceptPurchase'
                                : recommendation === 'REQUEST_INFO'
                                ? 'orders.recommendationRequestInfo'
                                : recommendation === 'REJECT'
                                ? 'orders.recommendationReject'
                                : 'orders.recommendationNeedsReview'
                            )}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {order.extractionMethod === 'ai' ? t('orders.ai') : t('orders.rules')} ·{' '}
                            {Math.round((analysis?.confidence ?? 0) * 100)}%
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400">{t('orders.notAnalysed')}</span>
                      )}
                    </td>
                    {mode === 'records' && (
                      <td className="py-3 px-3">
                        {order.purchaseDrafts.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                              {order.purchaseDrafts.length}{' '}
                              {order.purchaseDrafts.length > 1
                                ? t('orders.drafts')
                                : t('orders.draft')}
                            </p>
                            <p
                              className="text-[10px] text-slate-400 max-w-[170px] truncate"
                              title={order.purchaseDrafts
                                .map((draft) => draft.supplierName)
                                .join('\n')}
                            >
                              {order.purchaseDrafts
                                .map((draft) => draft.supplierName)
                                .join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="py-3 px-3 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 border-l border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col items-end gap-1">
                        {highRisk && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenOrder(order);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-bold ${
                              band === 'Critical'
                                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
                            }`}
                            title={t('orders.openRisk')}
                          >
                            <BarChart3 className="w-2.5 h-2.5" />
                            {t('orders.analysis')}
                          </button>
                        )}

                        {order.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('orders.approved')}
                          </span>
                        ) : order.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold">
                            <XCircle className="w-3 h-3" />
                            {t('orders.rejected')}
                          </span>
                        ) : order.status === 'info_requested' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            {t('orders.infoSent')}
                          </span>
                        ) : canConfirm ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleConfirm(order);
                            }}
                            disabled={actionId === order.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs disabled:opacity-60"
                          >
                            {actionId === order.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            {t('orders.confirm')}
                          </button>
                        ) : (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenOrder(order);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold hover:bg-slate-800 dark:hover:bg-slate-100"
                          >
                            {canApprove ? (
                              t('orders.review')
                            ) : (
                              <>
                                <Eye className="w-3 h-3" />
                                {t('orders.view')}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <ClipboardList className="w-3.5 h-3.5" />
        {mode === 'desk'
          ? canApprove
            ? t('orders.footerOwner')
            : t('orders.footerStaff')
          : t('orders.footerRecords')}
      </div>
    </div>
  );
};
