import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations, type Language, type TranslationKey } from './translations';
import { V2_TRANSLATIONS } from './v2Translations';

const STORAGE_KEY = 'orderflow_language';

const LOCALE_MAP: Record<Language, string> = {
  en: 'en-MY',
  zh: 'zh-CN',
  ms: 'ms-MY',
};

interface I18nValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey | string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh' || stored === 'ms') return stored;
  } catch {
    // localStorage may be unavailable in private or embedded contexts.
  }
  return 'en';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language === 'ms' ? 'ms' : 'en';
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Language still works for this session if storage is blocked.
    }
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey | string, vars?: Record<string, string | number>) => {
      const template =
        V2_TRANSLATIONS[language][key] ??
        translations[language][key as TranslationKey] ??
        V2_TRANSLATIONS.en[key] ??
        translations.en[key as TranslationKey] ??
        key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = vars[name];
        return value === undefined ? match : String(value);
      });
    },
    [language]
  );

  const value = useMemo<I18nValue>(
    () => ({
      language,
      locale: LOCALE_MAP[language],
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
