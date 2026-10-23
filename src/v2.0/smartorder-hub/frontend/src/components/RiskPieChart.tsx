import React, { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import { Order, RiskBand } from '../types/order';

interface RiskPieChartProps {
  orders: Order[];
}

interface Segment {
  key: string;
  label: string;
  count: number;
  color: string;
}

const BAND_COLORS: Record<RiskBand, string> = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#f97316',
  Critical: '#f43f5e',
};

const SIZE = 176;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const RiskPieChart: React.FC<RiskPieChartProps> = ({ orders }) => {
  const { segments, total } = useMemo(() => {
    const counts: Record<RiskBand, number> = {
      Low: 0,
      Medium: 0,
      High: 0,
      Critical: 0,
    };
    let unrated = 0;

    for (const order of orders) {
      const band = order.analysis?.riskBand;
      if (band && band in counts) {
        counts[band] += 1;
      } else {
        unrated += 1;
      }
    }

    const next: Segment[] = (
      ['Low', 'Medium', 'High', 'Critical'] as RiskBand[]
    ).map((band) => ({
      key: band,
      label: band,
      count: counts[band],
      color: BAND_COLORS[band],
    }));

    if (unrated > 0) {
      next.push({
        key: 'Unrated',
        label: 'Unrated',
        count: unrated,
        color: '#94a3b8',
      });
    }

    return {
      segments: next.filter((segment) => segment.count > 0),
      total: orders.length,
    };
  }, [orders]);

  let offset = 0;
  const arcs = segments.map((segment) => {
    const fraction = total > 0 ? segment.count / total : 0;
    const dash = fraction * CIRCUMFERENCE;
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
              Risk mix
            </h3>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            All {total} order{total === 1 ? '' : 's'} in this workspace
          </p>
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5">
          Current
        </span>
      </div>

      <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-3 mt-2 flex-1">
        <div className="relative shrink-0" aria-label={`Risk distribution of ${total} orders`}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={segments
              .map(
                (segment) =>
                  `${segment.label}: ${segment.count} of ${total} orders`
              )
              .join(', ') || 'No orders yet'}
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
              {total}
            </text>
            <text
              x="50%"
              y="60%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-400"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              orders
            </text>
          </svg>
        </div>

        <div className="w-full space-y-1.5">
          {segments.length === 0 ? (
            <p className="text-[10px] text-slate-400">
              No analysed orders yet. Run intake to build the risk mix.
            </p>
          ) : (
            segments.map((segment) => {
              const percent =
                total > 0 ? Math.round((segment.count / total) * 100) : 0;
              return (
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
                    {segment.count}
                  </span>
                  <span className="text-slate-400 tabular-nums w-8 text-right">
                    {percent}%
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
