import React, { useState, useRef, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { ResearchResult } from '../types';
import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  getMissingProviderKeys,
  getProviderDisplayName,
  LlmWorkflowService
} from '../services/llmWorkflowService';

const ResearchPanel: React.FC = () => {
  const {
    currentStep,
    apiKeys,
    config,
    topic,
    error,
    dispatch,
    podcastState
  } = useAppContext();
  const { t } = useI18n();

  const [researchTopic, setResearchTopic] = useState(topic || '');
  const [isResearching, setIsResearching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLandingView = currentStep === 'input' && !podcastState.research;

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsResearching(false);
    setLocalError(null);
    dispatch({ type: 'SET_LOADING', payload: false });
  }, [dispatch]);

  const handleStartResearch = async () => {
    if (!researchTopic.trim()) {
      setLocalError(t('research.error.enterTopic'));
      return;
    }

    const missingProviders = getMissingProviderKeys(apiKeys, config);
    if (missingProviders.length > 0) {
      setLocalError(
        t('llm.error.missingProviderKeys', {
          providers: missingProviders.map((provider) => getProviderDisplayName(provider)).join(', ')
        })
      );
      return;
    }

    try {
      setIsResearching(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const workflowService = new LlmWorkflowService({ apiKeys, config });
      const { result }: { result: ResearchResult } = await workflowService.researchTopic(researchTopic, { signal: abortController.signal });

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
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Research canceled by user');
        return;
      }
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
        
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm espresso-muted mr-1">{t('research.example.label' as any)}</span>
          <button
            onClick={() => setResearchTopic(t('research.example.topic1' as any))}
            disabled={isResearching}
            className="text-xs px-3 py-1.5 rounded-full espresso-card-soft hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('research.example.topic1' as any)}
          </button>
          <button
            onClick={() => setResearchTopic(t('research.example.topic2' as any))}
            disabled={isResearching}
            className="text-xs px-3 py-1.5 rounded-full espresso-card-soft hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('research.example.topic2' as any)}
          </button>
          <button
            onClick={() => setResearchTopic(t('research.example.topic3' as any))}
            disabled={isResearching}
            className="text-xs px-3 py-1.5 rounded-full espresso-card-soft hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('research.example.topic3' as any)}
          </button>
        </div>
      </div>

      {(error || localError) && (
        <div className="mb-6 p-4 rounded-md espresso-error">
          <p>{error || localError}</p>
        </div>
      )}

      {isResearching && (
        <div 
          className="fixed inset-0 espresso-overlay backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleCancel}
        >
          <div 
            className="espresso-card rounded-2xl p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-12 w-12 text-[#fab387] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-xl font-semibold text-white mb-2">{t('research.loading')}</h3>
              <p className="espresso-muted text-center mb-6">
                {t('script.modal.processingDescription')}
              </p>
              
              <button
                onClick={handleCancel}
                className="px-6 py-2 rounded-lg font-medium transition-all espresso-btn-danger"
              >
                {t('script.cancel')}
              </button>
            </div>
          </div>
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

          <div className="espresso-card rounded-lg p-6 mb-6 prose prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300 prose-headings:text-[#f5e0dc] prose-a:text-[#fab387]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {[
                `### ${t('research.summary')}`,
                podcastState.research.summary,
                '',
                `### ${t('research.keyPoints')}`,
                ...podcastState.research.keyPoints.map((point) => `- ${point}`),
                '',
                `### ${t('research.sources')}`,
                ...podcastState.research.sources.map((source) => `* **${source.title}**\n  ${source.snippet}\n  [${source.url}](${source.url})`)
              ].join('\n')}
            </ReactMarkdown>
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
