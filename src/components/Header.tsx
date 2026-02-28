import React, { useState } from 'react';
import { Radio, Settings, RotateCcw } from 'lucide-react';
import { ApiKeyPanel } from './ApiKeyPanel';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import { UILanguage } from '../types';

interface HeaderProps {
  onHomeClick?: () => void;
  onApiKeyClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onHomeClick, onApiKeyClick }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { currentStep } = useAppContext();
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
            {currentStep !== 'input' && (
              <button
                onClick={onHomeClick}
                className="flex items-center gap-1.5 px-3 py-2 mr-2 rounded-lg transition-colors espresso-btn-danger"
                aria-label={t('header.reset')}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">{t('header.reset')}</span>
              </button>
            )}

            <label className="text-sm espresso-muted hidden sm:block" htmlFor="language-selector">
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
