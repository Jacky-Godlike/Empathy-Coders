import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { LANGUAGE_OPTIONS, type Language } from '../i18n/translations';

export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, setLanguage, t } = useI18n();

  return (
    <label
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 shadow-xs transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
      title={t('language.label')}
    >
      <Languages className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      <span className="sr-only">{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="cursor-pointer bg-transparent pr-0.5 text-xs font-semibold text-slate-700 outline-none dark:text-slate-200"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {compact ? option.shortLabel : option.label}
          </option>
        ))}
      </select>
    </label>
  );
};
