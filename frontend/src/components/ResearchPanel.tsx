import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { PerplexityService } from '../services/perplexityService';
import { ResearchResult } from '../types';
import { Sparkles } from 'lucide-react';

const ResearchPanel: React.FC = () => {
  const {
    currentStep,
    apiKeys,
    topic,
    isLoading,
    error,
    dispatch,
    podcastState
  } = useAppContext();
  const { t } = useI18n();

  const [researchTopic, setResearchTopic] = useState(topic || '');
  const [isResearching, setIsResearching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isLandingView = currentStep === 'input' && !podcastState.research;

  const handleStartResearch = async () => {
    if (!researchTopic.trim()) {
      setLocalError(t('research.error.enterTopic'));
      return;
    }

    if (!apiKeys.perplexityKey) {
      setLocalError(t('research.error.missingPerplexity'));
      return;
    }

    try {
      setIsResearching(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const perplexityService = new PerplexityService(apiKeys.perplexityKey);
      const result: ResearchResult = await perplexityService.researchTopic(researchTopic);

      dispatch({
        type: 'UPDATE_PODCAST_STATE',
        payload: {
          research: result,
          topic: researchTopic,
          outline: null,
          script: null
        }
      });

      dispatch({
        type: 'SET_AUDIO_STATE',
        payload: {
          audioBlob: null,
          audioUrl: null,
          duration: 0,
          progress: 0,
          error: null
        }
      });

      dispatch({ type: 'SET_TOPIC', payload: researchTopic });
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'research' });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('research.error.unknown');
      setLocalError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_LOADING', payload: false });
    } finally {
      setIsResearching(false);
    }
  };

  const handleCopyResults = () => {
    if (podcastState.research) {
      const textToCopy = `
${t('research.copy.topic')}: ${podcastState.research.topic}

${t('research.summary')}:
${podcastState.research.summary}

${t('research.keyPoints')}:
${podcastState.research.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

${t('research.sources')}:
${podcastState.research.sources.map((source, i) => `${i + 1}. ${source.title} - ${source.url}`).join('\n')}
      `.trim();

      navigator.clipboard.writeText(textToCopy);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {isLandingView ? (
        <div className="relative overflow-hidden espresso-card rounded-3xl p-7 md:p-10 mb-8">
          <div className="absolute -top-24 -right-24 h-52 w-52 rounded-full bg-[#89b4fa]/15 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-[#fab387]/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs tracking-wide uppercase espresso-card-soft mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('research.landingEyebrow')}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold leading-tight mb-3">{t('research.landingTitle')}</h2>
            <p className="espresso-muted max-w-3xl">{t('research.landingDescription')}</p>
            <div className="grid gap-3 md:grid-cols-3 mt-6">
              <div className="espresso-card-soft rounded-xl p-3 text-sm">{t('research.nextStepResearch')}</div>
              <div className="espresso-card-soft rounded-xl p-3 text-sm">{t('research.nextStepOutline')}</div>
              <div className="espresso-card-soft rounded-xl p-3 text-sm">{t('research.nextStepScriptAudio')}</div>
            </div>
          </div>
        </div>
      ) : (
        <h2 className="text-2xl font-bold mb-6">{t('research.title')}</h2>
      )}

      <div className="mb-6 espresso-card rounded-2xl p-4 md:p-5">
        <label htmlFor="researchTopic" className="block text-sm font-medium espresso-muted mb-2">
          {t('research.topicLabel')}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            id="researchTopic"
            value={researchTopic}
            onChange={(e) => setResearchTopic(e.target.value)}
            className="flex-1 px-4 py-3 rounded-md espresso-input"
            placeholder={t('research.placeholder')}
            disabled={isResearching}
          />
          <button
            onClick={handleStartResearch}
            disabled={isResearching}
            className={`px-6 py-3 rounded-md font-medium transition-all whitespace-nowrap ${
              isResearching
                ? 'espresso-btn-secondary cursor-not-allowed opacity-70'
                : 'espresso-btn-primary'
            }`}
          >
            {isResearching ? t('research.working') : t('research.start')}
          </button>
        </div>
      </div>

      {(error || localError) && (
        <div className="mb-6 p-4 rounded-md espresso-error">
          <p>{error || localError}</p>
        </div>
      )}

      {isLoading && (
        <div className="mb-6 flex flex-col items-center justify-center p-8 rounded-md espresso-card-soft">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#fab387] mb-4"></div>
          <p className="espresso-muted">{t('research.loading')}</p>
        </div>
      )}

      {podcastState.research && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">{t('research.resultsTitle')}</h3>
            <button
              onClick={handleCopyResults}
              className="px-4 py-2 rounded-md text-sm font-medium espresso-btn-secondary"
            >
              {t('research.copy')}
            </button>
          </div>

          <div className="espresso-card rounded-lg p-6 mb-6">
            <h4 className="text-lg font-medium mb-3">{t('research.summary')}</h4>
            <p className="espresso-muted whitespace-pre-wrap">{podcastState.research.summary}</p>
          </div>

          <div className="espresso-card rounded-lg p-6 mb-6">
            <h4 className="text-lg font-medium mb-3">{t('research.keyPoints')}</h4>
            <ul className="list-disc pl-5 space-y-2">
              {podcastState.research.keyPoints.map((point, index) => (
                <li key={index} className="espresso-muted">{point}</li>
              ))}
            </ul>
          </div>

          <div className="espresso-card rounded-lg p-6">
            <h4 className="text-lg font-medium mb-3">{t('research.sources')}</h4>
            <ul className="space-y-3">
              {podcastState.research.sources.map((source, index) => (
                <li key={index} className="border-b espresso-divider pb-3 last:border-0 last:pb-0">
                  <h5 className="font-medium text-[#f5e0dc]">{source.title}</h5>
                  <p className="text-sm espresso-muted mt-1">{source.snippet}</p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#fab387] hover:text-[#f8bd96] text-sm mt-1 inline-block"
                  >
                    {source.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <button
              onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'outline' })}
              className="px-6 py-3 font-medium rounded-md espresso-btn-primary"
            >
              {t('research.toOutline')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchPanel;
