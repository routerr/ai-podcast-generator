import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { UILanguage } from '../types';
import { DEFAULT_LANGUAGE, TranslationKey, getTranslation } from '../i18n/translations';

const LANGUAGE_STORAGE_KEY = 'ai_podcast_generator_language';

interface I18nContextType {
  language: UILanguage;
  setLanguage: (language: UILanguage) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const isUILanguage = (value: string | null): value is UILanguage => {
  return value === 'en' || value === 'ja' || value === 'zh-CN' || value === 'zh-TW';
};

const getInitialLanguage = (): UILanguage => {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isUILanguage(storedLanguage)) {
    return storedLanguage;
  }

  return DEFAULT_LANGUAGE;
};

interface I18nProviderProps {
  children: React.ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<UILanguage>(getInitialLanguage);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<I18nContextType>(() => ({
    language,
    setLanguage,
    t: (key, params) => getTranslation(language, key, params)
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
};
