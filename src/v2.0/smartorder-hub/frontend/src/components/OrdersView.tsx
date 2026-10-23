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
import { CurrentUser, canApproveOrders } from '../types/user';

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
  email:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  manual:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

function stockBadge(order: Order, industry: IndustryProfile) {
  const lines = order.analysis?.stock ?? [];
  const title = lines
    .map(
      (line) =>
        `${line.name}: need ${line.required}, available ${line.available}, short ${line.shortfall}`
    )
    .join('\n');

  if (!lines.length) {
    return {
      label: `No ${industry.labels.stock.toLowerCase()} check`,
      className:
        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      title: 'Run the analysis to see the availability check.',
    };
  }

  const short = lines.filter((line) => line.shortfall > 0);
  if (short.some((line) => !line.canReplenishInTime)) {
    return {
      label: 'Cannot meet date',
      className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      title,
    };
  }
  if (short.length > 0) {
    const noun =
      industry.inventoryMode === 'capacity'
        ? 'capacity short'
        : industry.inventoryMode === 'material'
        ? 'material short'
        : `item${short.length > 1 ? 's' : ''} to replenish`;
    return {
      label: `${short.length} ${noun}`,
      className:
        'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      title,
    };
  }
  return {
    label:
      industry.inventoryMode === 'capacity'
        ? 'Capacity OK'
        : industry.inventoryMode === 'material'
        ? 'Material ready'
        : 'In stock',
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
              `Intake complete: ${result.processed} messages scanned, ` +
                `${result.ordersCreated} orders created, ` +
                `${result.processed - result.ordersCreated} filtered out.`
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
        setError(
          err instanceof Error ? err.message : 'Could not load the order table'
        );
      } finally {
        setIsLoading(false);
        setIsProcessing(false);
      }
    },
    [mode, onDataChanged]
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
        note: `Confirmed by ${currentUser.name} (${currentUser.role}) from the order review table.`,
      });
      setOrders((prev) =>
        prev.map((item) => (item.id === result.order.id ? result.order : item))
      );
      setSummary(await fetchIntakeSummary());
      onDataChanged?.();
      const drafts = result.order.purchaseDrafts.length;
      setNotice(
        `${result.order.id} approved` +
          (drafts ? ` — ${drafts} purchase draft(s) created.` : '.')
      );
      // Keep the confirmed row visible instead of making it disappear from the queue.
      setFilter('all');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not confirm the order'
      );
    } finally {
      setActionId(null);
    }
  };

  const filterOptions: [Filter, string][] =
    mode === 'desk'
      ? [
          ['pending', `Needs confirmation (${counts.pending})`],
          ['all', `All orders (${counts.all})`],
          ['approved', `Approved (${counts.approved})`],
          ['info', `Info requested (${counts.info})`],
          ['rejected', `Rejected (${counts.rejected})`],
        ]
      : [
          ['all', `All records (${counts.all})`],
          ['approved', `Approved (${counts.approved})`],
          ['info', `Info requested (${counts.info})`],
          ['rejected', `Rejected (${counts.rejected})`],
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
              {mode === 'desk' ? 'Order review' : 'Order records & purchases'}
            </h2>
            <span
              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                canApprove
                  ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
              }`}
            >
              {canApprove ? 'Owner approval' : 'View only'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
            {mode === 'desk'
              ? 'The intake engine has already read the raw messages. Confirm a clean row on the right; open the exceptions for the full reasoning.'
              : 'Every approved, rejected and information-requested order, plus the purchase drafts generated for replenishment.'}
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
            Refresh
          </button>
          <a
            href={exportXlsxUrl()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </a>
          <a
            href={exportCsvUrl()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
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
          <span>
            SmartOrder Hub is reading the raw WhatsApp and email messages,
            classifying orders, inquiries, ads and after-sales…
          </span>
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
            aria-label="Dismiss"
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
              View-only access · {currentUser.name}
            </p>
            <p className="text-[11px] opacity-80 mt-0.5">
              Staff can review every order, its stock, margin and risk
              analysis, but only the Owner can confirm or reject. Switch the
              identity in the top-right to owner.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards + risk mix */}
      {mode === 'desk' ? (
        <div className="grid gap-2.5 lg:grid-cols-[310px_1fr]">
          <RiskPieChart orders={orders} />
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              label="Messages scanned"
              value={summary?.totalMessages ?? '—'}
              hint="WhatsApp, email and manual"
              Icon={Inbox}
              tone="slate"
            />
            <StatCard
              label="Orders detected"
              value={summary?.orders ?? '—'}
              hint="Only real orders reach this table"
              Icon={ClipboardList}
              tone="blue"
            />
            <StatCard
              label="Filtered out"
              value={summary ? summary.totalMessages - summary.orders : '—'}
              hint="Inquiries, ads, after-sales, noise"
              Icon={FilterX}
              tone="slate"
            />
            <StatCard
              label="Awaiting confirmation"
              value={summary?.awaitingConfirmation ?? '—'}
              hint="Click Confirm on the right"
              Icon={Clock}
              tone="amber"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatCard
            label="Approved orders"
            value={recordStats.approved}
            hint="Human-approved records"
            Icon={CheckCircle2}
            tone="emerald"
          />
          <StatCard
            label="Purchase drafts"
            value={recordStats.drafts}
            hint="Replenishment proposals, not real POs"
            Icon={ShoppingCart}
            tone="blue"
          />
          <StatCard
            label="Awaiting information"
            value={recordStats.info}
            hint="Customer reply needed"
            Icon={Clock}
            tone="amber"
          />
          <StatCard
            label="Approved value"
            value={money(recordStats.value)}
            hint="Revenue on approved orders"
            Icon={Package}
            tone="slate"
          />
        </div>
      )}

      {summary && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Auto-classified {summary.processedMessages} of {summary.totalMessages}{' '}
          messages: {summary.byType.order ?? 0} orders,{' '}
          {summary.byType.inquiry ?? 0} inquiries, {summary.byType.ad ?? 0} ads,{' '}
          {summary.byType.after_sales ?? 0} after-sales,{' '}
          {summary.byType.other ?? 0} other, {summary.byType.uncertain ?? 0}{' '}
          uncertain.
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
              ? 'All caught up'
              : mode === 'records' && counts.all === 0
              ? 'No order records yet'
              : 'No orders in this filter'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filter === 'pending' && counts.all > 0
              ? 'No order is waiting for confirmation. Check All orders or the raw Inbox.'
              : mode === 'records' && counts.all === 0
              ? 'Open the Order Desk to run intake and confirm the first order.'
              : 'Nothing matches this status yet. Try All orders.'}
          </p>
          {filter !== 'all' && counts.all > 0 && (
            <button
              onClick={() => setFilter('all')}
              className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            >
              View all orders
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
                <th className="py-2.5 px-3 font-semibold">Order</th>
                <th className="py-2.5 px-3 font-semibold">Source</th>
                <th className="py-2.5 px-3 font-semibold">Customer</th>
                <th className="py-2.5 px-3 font-semibold">
                  {industry.labels.summary}
                </th>
                {tableFields.length > 0 && (
                  <th className="py-2.5 px-3 font-semibold">
                    {industry.labels.details}
                  </th>
                )}
                <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                <th className="py-2.5 px-3 font-semibold">
                  {industry.labels.date}
                </th>
                <th className="py-2.5 px-3 font-semibold">
                  {industry.labels.stock}
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">Margin</th>
                <th className="py-2.5 px-3 font-semibold">Risk</th>
                <th className="py-2.5 px-3 font-semibold">Recommendation</th>
                {mode === 'records' && (
                  <th className="py-2.5 px-3 font-semibold">Purchases</th>
                )}
                <th className="py-2.5 px-3 font-semibold text-right sticky right-0 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">
                  Action
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
                const stock = stockBadge(order, industry);
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
                    .join('\n') || 'No risk factors available';
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
                        {order.source}
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
                                +{detailValues.length - 3} more
                              </p>
                            )}
                            {missingRequired.map((field) => (
                              <p
                                key={`missing-${field.key}`}
                                className="text-[10px] font-semibold text-rose-600 dark:text-rose-400"
                              >
                                {field.label} missing
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
                        {order.requestedDeliveryDate || 'No date'}
                      </p>
                      <p
                        className="text-[10px] text-slate-400 max-w-[190px] truncate"
                        title={order.deliveryAddress}
                      >
                        {order.deliveryAddress || 'No address'}
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
                          {band} · {Math.round(analysis.riskScore)}
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
                            {recommendation.replace(/_/g, ' ')}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {order.extractionMethod === 'ai' ? 'AI' : 'Rules'} ·{' '}
                            {Math.round((analysis?.confidence ?? 0) * 100)}%
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400">Not analysed</span>
                      )}
                    </td>
                    {mode === 'records' && (
                      <td className="py-3 px-3">
                        {order.purchaseDrafts.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                              {order.purchaseDrafts.length} draft
                              {order.purchaseDrafts.length > 1 ? 's' : ''}
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
                            title="Open the full risk analysis"
                          >
                            <BarChart3 className="w-2.5 h-2.5" />
                            Analysis
                          </button>
                        )}

                        {order.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : order.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        ) : order.status === 'info_requested' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            Info sent
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
                            Confirm
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
                              'Review'
                            ) : (
                              <>
                                <Eye className="w-3 h-3" />
                                View
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
            ? 'Confirm is a one-click owner approval. Click a row for stock, risk factors, purchase drafts and the activity log.'
            : 'View-only mode: staff can inspect every row and its analysis, but only the Owner can confirm.'
          : 'Purchase drafts are proposals only — no real purchase order is sent. Click a row to see the full approval trail.'}
      </div>
    </div>
  );
};
