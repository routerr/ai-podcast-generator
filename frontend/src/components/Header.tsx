import React, { useState } from 'react';
import { Radio, Settings } from 'lucide-react';
import { ApiKeyPanel } from './ApiKeyPanel';
import { useI18n } from '../contexts/I18nContext';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import { UILanguage } from '../types';

interface HeaderProps {
  onHomeClick?: () => void;
  onApiKeyClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onHomeClick, onApiKeyClick }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { language, setLanguage, t } = useI18n();

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  return (
    <>
      <header className="border-b espresso-divider espresso-basic-bg backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl espresso-card-soft">
              <Radio className="w-6 h-6 text-[#fab387]" />
            </div>
            <div>
              <a
                href="/"
                onClick={(event) => {
                  if (onHomeClick) {
                    event.preventDefault();
                    onHomeClick();
                  }
                }}
                className="text-xl font-bold hover:text-[#f8bd96] transition-colors"
              >
                AI Podcast Generator
              </a>
              <p className="text-sm espresso-muted">{t('header.subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm espresso-muted" htmlFor="language-selector">
              {t('header.language')}
            </label>
            <select
              id="language-selector"
              value={language}
              onChange={(event) => setLanguage(event.target.value as UILanguage)}
              className="rounded-lg px-2 py-2 text-sm focus:outline-none espresso-select"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>

            <button
              onClick={onApiKeyClick || togglePanel}
              className="p-2 rounded-lg transition-colors espresso-btn-secondary"
              aria-label={t('header.apiSettingsAria')}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {isPanelOpen && (
        <ApiKeyPanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
        />
      )}
    </>
  );
};
