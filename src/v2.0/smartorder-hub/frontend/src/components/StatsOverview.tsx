import React from 'react';
import { Inbox, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { OrderMessage, RecognitionStatus } from '../types/message';
import { useI18n } from '../i18n/I18nContext';

interface StatsOverviewProps {
  messages: OrderMessage[];
  currentStatusFilter: RecognitionStatus | 'all';
  onSelectStatusFilter: (status: RecognitionStatus | 'all') => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  messages,
  currentStatusFilter,
  onSelectStatusFilter,
}) => {
  const { t } = useI18n();
  const total = messages.length;
  const pending = messages.filter((m) => m.status === 'not_analyzed').length;
  const recognized = messages.filter((m) => m.status === 'recognized_as_order').length;
  const review = messages.filter((m) => m.status === 'needs_human_review').length;

  const cards = [
    {
      title: t('stats.total'),
      value: total,
      icon: Inbox,
      filter: 'all' as const,
      color: 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800',
      iconBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      activeBorder: 'ring-2 ring-slate-900 dark:ring-white',
    },
    {
      title: t('stats.pending'),
      value: pending,
      icon: Clock,
      filter: 'not_analyzed' as const,
      color: 'border-blue-100 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900/40',
      iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
      activeBorder: 'ring-2 ring-blue-600',
    },
    {
      title: t('stats.recognized'),
      value: recognized,
      icon: CheckCircle2,
      filter: 'recognized_as_order' as const,
      color: 'border-emerald-100 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900/40',
      iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
      activeBorder: 'ring-2 ring-emerald-600',
    },
    {
      title: t('stats.review'),
      value: review,
      icon: AlertTriangle,
      filter: 'needs_human_review' as const,
      color: 'border-amber-100 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40',
      iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      activeBorder: 'ring-2 ring-amber-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = currentStatusFilter === card.filter;

        return (
          <button
            key={card.title}
            onClick={() => onSelectStatusFilter(card.filter)}
            type="button"
            className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
              card.color
            } ${isActive ? card.activeBorder : 'hover:border-slate-300 dark:hover:border-slate-700'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-lg ${card.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {card.value}
              </span>
              {isActive && (
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  {t('stats.filtered')}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
