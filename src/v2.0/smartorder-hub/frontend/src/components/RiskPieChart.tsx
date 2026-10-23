import React, { useMemo } from 'react';
import { ChevronRight, PieChart } from 'lucide-react';
import { Order, RiskBand } from '../types/order';
import { useI18n } from '../i18n/I18nContext';

interface RiskPieChartProps {
  orders: Order[];
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface BandBreakdown {
  band: RiskBand;
  orders: number;
  segments: Segment[];
  total: number;
}

const BANDS: RiskBand[] = ['Low', 'Medium', 'High', 'Critical'];
const BREAKDOWN_BANDS: RiskBand[] = ['Low', 'Medium', 'High'];

const BAND_COLORS: Record<RiskBand, string> = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#f97316',
  Critical: '#f43f5e',
};

const FACTOR_COLORS: Record<string, string> = {
  stock: '#3b82f6',
  delivery: '#8b5cf6',
  margin: '#14b8a6',
  data: '#f59e0b',
  anomaly: '#f43f5e',
};

const SIZE = 112;
const STROKE = 17;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const Donut: React.FC<{
  segments: Segment[];
  totalValue: number;
  centerValue: number;
  centerLabel: string;
  ariaLabel: string;
  size?: number;
}> = ({
  segments,
  totalValue,
  centerValue,
  centerLabel,
  ariaLabel,
  size = SIZE,
}) => {
  const stroke = (STROKE * size) / SIZE;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const fraction = totalValue > 0 ? segment.value / totalValue : 0;
      const dash = fraction * circumference;
      const gap = segments.length > 1 ? Math.min(3, dash / 3) : 0;
      const visibleDash = Math.max(0, dash - gap);
      const arc = {
        ...segment,
        dashArray: `${visibleDash} ${circumference - visibleDash}`,
        dashOffset: -offset,
      };
      offset += dash;
      return arc;
    });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel}
      className="shrink-0"
      style={{ transition: 'width 500ms ease, height 500ms ease' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-slate-100 dark:stroke-slate-800"
      />
      {arcs.map((arc) => (
        <circle
          key={arc.key}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={arc.color}
          strokeWidth={stroke}
          strokeDasharray={arc.dashArray}
          strokeDashoffset={arc.dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 400ms ease' }}
        />
      ))}
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-900 dark:fill-white"
        style={{ fontSize: (23 * size) / SIZE, fontWeight: 800 }}
      >
        {centerValue}
      </text>
      <text
        x="50%"
        y="61%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-400"
        style={{ fontSize: (9 * size) / SIZE, fontWeight: 600 }}
      >
        {centerLabel}
      </text>
    </svg>
  );
};

export const RiskPieChart: React.FC<RiskPieChartProps> = ({
  orders,
  isExpanded,
  onExpandedChange,
}) => {
  const { t } = useI18n();
  const riskLabels: Record<RiskBand, string> = {
    Low: t('orders.riskLow'),
    Medium: t('orders.riskMedium'),
    High: t('orders.riskHigh'),
    Critical: t('orders.riskCritical'),
  };
  const factorLabels: Record<string, string> = {
    stock: t('settings.risk.stock'),
    delivery: t('settings.risk.delivery'),
    margin: t('settings.risk.margin'),
    data: t('settings.risk.data'),
    anomaly: t('settings.risk.anomaly'),
  };

  const { overallSegments, breakdowns } = useMemo(() => {
    const bandCounts: Record<RiskBand, number> = {
      Low: 0,
      Medium: 0,
      High: 0,
      Critical: 0,
    };
    const bandFactors: Record<
      RiskBand,
      Map<string, { label: string; value: number }>
    > = {
      Low: new Map(),
      Medium: new Map(),
      High: new Map(),
      Critical: new Map(),
    };
    let unrated = 0;

    for (const order of orders) {
      const band = order.analysis?.riskBand;
      if (!band || !BANDS.includes(band)) {
        unrated += 1;
        continue;
      }

      bandCounts[band] += 1;
      for (const factor of order.analysis?.riskFactors ?? []) {
        const value = Number.isFinite(factor.weighted)
          ? Math.max(0, factor.weighted)
          : 0;
        const existing = bandFactors[band].get(factor.key);
        bandFactors[band].set(factor.key, {
          label: factorLabels[factor.key] ?? factor.label,
          value: (existing?.value ?? 0) + value,
        });
      }
    }

    const overall: Segment[] = BANDS.map((band) => ({
      key: band,
      label: riskLabels[band],
      value: bandCounts[band],
      color: BAND_COLORS[band],
    }));
    if (unrated > 0) {
      overall.push({
        key: 'Unrated',
        label: t('orders.unrated'),
        value: unrated,
        color: '#94a3b8',
      });
    }

    const byBand = BREAKDOWN_BANDS.map((band): BandBreakdown => {
      const segments = Array.from(bandFactors[band], ([key, factor]) => ({
        key,
        label: factor.label,
        value: factor.value,
        color: FACTOR_COLORS[key] ?? '#64748b',
      }))
        .filter((segment) => segment.value > 0)
        .sort((a, b) => b.value - a.value);

      return {
        band,
        orders: bandCounts[band],
        segments,
        total: segments.reduce((sum, segment) => sum + segment.value, 0),
      };
    });

    return {
      overallSegments: overall.filter((segment) => segment.value > 0),
      breakdowns: byBand,
    };
  }, [orders, riskLabels, factorLabels, t]);

  const total = orders.length;

  const renderLegend = (segments: Segment[], totalValue: number) => (
    <div className="w-full min-w-0 space-y-1">
      {segments.length === 0 ? (
        <p className="text-[10px] text-slate-400">{t('orders.noRiskFactors')}</p>
      ) : (
        segments.map((segment) => {
          const percent =
            totalValue > 0
              ? Math.round((segment.value / totalValue) * 100)
              : 0;
          return (
            <div
              key={segment.key}
              className="flex items-center gap-1.5 text-[9px]"
              title={`${segment.label}: ${percent}%`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-slate-600 dark:text-slate-300 flex-1 min-w-0 truncate">
                {segment.label}
              </span>
              <span className="text-slate-400 tabular-nums shrink-0">
                {percent}%
              </span>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-slate-500" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('orders.riskMix')}
            </h3>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {t('orders.riskMixSubtitle', { count: total })}
          </p>
          <p className="text-[10px] text-slate-400">
            {t('orders.riskCategoriesSubtitle')}
          </p>
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5">
          {t('orders.current')}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 xl:flex xl:items-stretch">
        <div
          className={`rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 transition-[width] duration-500 ease-in-out xl:shrink-0 ${
            isExpanded ? 'xl:w-1/6' : 'xl:w-full'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
              {t('orders.overall')}
            </h4>
            <button
              type="button"
              onClick={() => onExpandedChange(!isExpanded)}
              aria-expanded={isExpanded}
              aria-controls="risk-band-breakdowns"
              aria-label={
                isExpanded
                  ? t('orders.hideRiskCategories')
                  : t('orders.showRiskCategories')
              }
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[9px] font-medium text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              <span>{t('orders.clickRiskCategories')}</span>
              <ChevronRight
                aria-hidden="true"
                className={`h-3 w-3 shrink-0 transition-transform duration-300 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => onExpandedChange(!isExpanded)}
              aria-expanded={isExpanded}
              aria-controls="risk-band-breakdowns"
              aria-label={t('orders.overall')}
              title={t('orders.overall')}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Donut
                segments={overallSegments}
                totalValue={total}
                centerValue={total}
                centerLabel={t('orders.ordersShort')}
                ariaLabel={
                  overallSegments
                    .map((segment) =>
                      t('orders.segmentAria', {
                        label: segment.label,
                        count: segment.value,
                        total,
                      })
                    )
                    .join(', ') || t('orders.noOrdersYet')
                }
                size={isExpanded ? SIZE : 176}
              />
            </button>
            <div className="min-w-0 flex-1">
              {renderLegend(overallSegments, total)}
              {overallSegments.length === 0 && (
                <p className="text-[9px] text-slate-400 mt-1">
                  {t('orders.noAnalysed')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          id="risk-band-breakdowns"
          aria-hidden={!isExpanded}
          className={`grid min-w-0 grid-cols-1 gap-2 overflow-hidden transition-[max-width,max-height,opacity,transform] duration-500 ease-in-out xl:grid-cols-3 xl:flex-1 ${
            isExpanded
              ? 'translate-x-0 opacity-100'
              : 'pointer-events-none translate-x-4 opacity-0'
          }`}
          style={{
            maxHeight: isExpanded ? 1000 : 0,
            maxWidth: isExpanded ? '100%' : 0,
          }}
        >
          {breakdowns.map((breakdown) => (
            <div
              key={breakdown.band}
              className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 p-2.5"
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <h4 className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                  {riskLabels[breakdown.band]}
                </h4>
                <span className="text-[9px] text-slate-400 tabular-nums">
                  {breakdown.orders} {t('orders.ordersShort')}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Donut
                  segments={breakdown.segments}
                  totalValue={breakdown.total}
                  centerValue={breakdown.orders}
                  centerLabel={t('orders.ordersShort')}
                  size={144}
                  ariaLabel={breakdown.segments
                    .map((segment) => {
                      const percent =
                        breakdown.total > 0
                          ? Math.round((segment.value / breakdown.total) * 100)
                          : 0;
                      return t('orders.riskFactorShareAria', {
                        label: segment.label,
                        percent,
                      });
                    })
                    .join(', ') || t('orders.noRiskFactors')}
                />
                <div className="min-w-0 flex-1">
                  {renderLegend(breakdown.segments, breakdown.total)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
