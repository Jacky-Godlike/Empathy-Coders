import React from 'react';
import { Search, X, Filter, RotateCcw } from 'lucide-react';
import { MessageSource, RecognitionStatus } from '../types/message';
import { MESSAGE_SOURCES, SOURCE_LABEL_KEYS } from '../config/sources';
import { useI18n } from '../i18n/I18nContext';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sourceFilter: MessageSource | 'all';
  onSourceChange: (source: MessageSource | 'all') => void;
  statusFilter: RecognitionStatus | 'all';
  onStatusChange: (status: RecognitionStatus | 'all') => void;
  onResetFilters: () => void;
  totalFiltered: number;
  totalCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  sourceFilter,
  onSourceChange,
  statusFilter,
  onStatusChange,
  onResetFilters,
  totalFiltered,
  totalCount,
}) => {
  const { t } = useI18n();
  const isFiltered =
    searchQuery !== '' || sourceFilter !== 'all' || statusFilter !== 'all';

  const sourceOptions: { value: MessageSource | 'all'; label: string }[] = [
    { value: 'all', label: t('filter.allSources') },
    ...MESSAGE_SOURCES.map((source) => ({
      value: source,
      label: t(SOURCE_LABEL_KEYS[source]),
    })),
  ];

  const statusOptions: { value: RecognitionStatus | 'all'; label: string }[] = [
    { value: 'all', label: t('filter.allStatuses') },
    { value: 'not_analyzed', label: t('status.not_analyzed') },
    { value: 'processing', label: t('status.processing') },
    { value: 'recognized_as_order', label: t('status.recognized_as_order') },
    { value: 'needs_human_review', label: t('status.needs_human_review') },
    { value: 'not_an_order', label: t('status.not_an_order') },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-5 shadow-xs space-y-3.5">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('filter.searchPlaceholder')}
            className="w-full pl-10 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              title={t('filter.clearSearch')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{t('filter.showing', { filtered: totalFiltered, total: totalCount })}</span>
          {isFiltered && (
            <button
              onClick={onResetFilters}
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition"
            >
              <RotateCcw className="w-3 h-3" />
              {t('filter.reset')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>{t('filter.filters')}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {sourceOptions.map((opt) => {
            const active = sourceFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onSourceChange(opt.value)}
                type="button"
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5">
          <label htmlFor="status-select" className="text-xs text-slate-500 dark:text-slate-400">
            {t('filter.status')}
          </label>
          <select
            id="status-select"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as RecognitionStatus | 'all')}
            className="text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
