import React, { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import { Order } from '../types/order';
import { useI18n } from '../i18n/I18nContext';

interface RiskTypePieChartProps {
  orders: Order[];
}

interface Segment {
  key: string;
  label: string;
  points: number;
  share: number;
  color: string;
}

const TYPE_COLORS: Record<string, string> = {
  stock: '#567a49',
  delivery: '#b45a2c',
  margin: '#d97706',
  data: '#8d6e63',
  anomaly: '#be123c',
};

const FACTOR_ORDER = ['stock', 'delivery', 'margin', 'data', 'anomaly'];

const SIZE = 176;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const RiskTypePieChart: React.FC<RiskTypePieChartProps> = ({ orders }) => {
  const { t } = useI18n();

  const { segments, analysedOrders } = useMemo(() => {
    const totals: Record<string, number> = {
      stock: 0,
      delivery: 0,
      margin: 0,
      data: 0,
      anomaly: 0,
    };
    let analysed = 0;

    for (const order of orders) {
      const factors = order.analysis?.riskFactors;
      if (!factors?.length) continue;
      analysed += 1;
      for (const factor of factors) {
        if (factor.key in totals) {
          totals[factor.key] += Number(factor.weighted) || 0;
        }
      }
    }

    const totalPoints = Object.values(totals).reduce(
      (sum, value) => sum + value,
      0
    );
    const next: Segment[] = FACTOR_ORDER.filter((key) => totals[key] > 0)
      .map((key) => ({
        key,
        label: t(`settings.risk.${key}`),
        points: totals[key],
        share: totalPoints > 0 ? totals[key] / totalPoints : 0,
        color: TYPE_COLORS[key],
      }))
      .sort((a, b) => b.points - a.points);

    return { segments: next, analysedOrders: analysed };
  }, [orders, t]);

  let offset = 0;
  const arcs = segments.map((segment) => {
    const dash = segment.share * CIRCUMFERENCE;
    const gap = segments.length > 1 ? Math.min(4, dash / 3) : 0;
    const arc = {
      ...segment,
      dashArray: `${Math.max(0, dash - gap)} ${CIRCUMFERENCE - Math.max(0, dash - gap)}`,
      dashOffset: -offset,
    };
    offset += dash;
    return arc;
  });

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-slate-500" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('orders.riskTypeMix')}
            </h3>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {t('orders.riskTypeMixSubtitle', { count: analysedOrders })}
          </p>
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5">
          {t('orders.current')}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-3 mt-2 flex-1">
        <div
          className="relative shrink-0"
          aria-label={t('orders.riskTypeAria', { count: analysedOrders })}
        >
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={segments
              .map(
                (segment) =>
                  `${segment.label}: ${Math.round(segment.share * 100)}%`
              )
              .join(', ') || t('orders.noRiskTypes')}
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-slate-100 dark:stroke-slate-800"
            />
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={STROKE}
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                style={{ transition: 'stroke-dasharray 400ms ease' }}
              />
            ))}
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-900 dark:fill-white"
              style={{ fontSize: 28, fontWeight: 800 }}
            >
              {segments.length}
            </text>
            <text
              x="50%"
              y="60%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-400"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {t('orders.riskTypesShort')}
            </text>
          </svg>
        </div>

        <div className="w-full space-y-1.5">
          {segments.length === 0 ? (
            <p className="text-[10px] text-slate-400">
              {t('orders.noRiskTypes')}
            </p>
          ) : (
            segments.map((segment) => (
              <div
                key={segment.key}
                className="flex items-center gap-2 text-[10px]"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-slate-600 dark:text-slate-300 flex-1">
                  {segment.label}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  {Math.round(segment.share * 100)}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
