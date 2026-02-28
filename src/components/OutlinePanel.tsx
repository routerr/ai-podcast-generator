import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { Outline, OutlineSection } from '../types';
import {
  getMissingProviderKeys,
  getProviderDisplayName,
  LlmWorkflowService
} from '../services/llmWorkflowService';

const OutlinePanel: React.FC = () => {
  const {
    apiKeys,
    config,
    podcastState,
    error,
    dispatch
  } = useAppContext();
  const { t } = useI18n();

  const [outline, setOutline] = useState<Outline | null>(podcastState.outline || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  
  // Track if we've already attempted an auto-generation on mount
  const hasAttemptedGeneration = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsRefining(false);
    setLocalError(null);
    dispatch({ type: 'SET_LOADING', payload: false });
  }, [dispatch]);

  useEffect(() => {
    if (podcastState.outline) {
      setOutline(podcastState.outline);
    }
  }, [podcastState.outline]);

  // Auto-trigger generation if navigating here with research but no outline
  useEffect(() => {
    if (
      podcastState.research && 
      !outline && 
      !isGenerating && 
      !hasAttemptedGeneration.current
    ) {
      hasAttemptedGeneration.current = true;
      handleGenerateOutline();
    }
  }, [podcastState.research, outline, isGenerating]);

  const handleGenerateOutline = async () => {
    if (!podcastState.research) {
      setLocalError(t('outline.error.needResearch'));
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
      setIsGenerating(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const workflowService = new LlmWorkflowService({ apiKeys, config });
      const { result }: { result: Outline } = await workflowService.generateOutline(podcastState.research, { signal: abortController.signal });

      setOutline(result);
      dispatch({
        type: 'UPDATE_PODCAST_STATE',
        payload: {
          outline: result,
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

      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Outline generation canceled by user');
        return;
      }
      const errorMessage = err instanceof Error ? err.message : t('outline.error.generateUnknown');
      setLocalError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_LOADING', payload: false });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineOutline = async () => {
    if (!outline) {
      setLocalError(t('outline.error.nothingToRefine'));
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
      setIsRefining(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const researchWithOutline = {
        ...podcastState.research!,
        summary: `${podcastState.research!.summary}\n\n${t('outline.currentOutline')}:\n${outline.title}\n${outline.description}\n${outline.sections.map((s) => `- ${s.title}`).join('\n')}`
      };

      const workflowService = new LlmWorkflowService({ apiKeys, config });
      const { result }: { result: Outline } = await workflowService.generateOutline(researchWithOutline, { signal: abortController.signal });

      setOutline(result);
      dispatch({
        type: 'UPDATE_PODCAST_STATE',
        payload: {
          outline: result,
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

      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Outline refinement canceled by user');
        return;
      }
      const errorMessage = err instanceof Error ? err.message : t('outline.error.refineUnknown');
      setLocalError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_LOADING', payload: false });
    } finally {
      setIsRefining(false);
    }
  };

  const handleEditSectionTitle = (sectionId: string, currentTitle: string) => {
    setEditingSection(sectionId);
    setEditedTitle(currentTitle);
  };

  const handleSaveSectionTitle = (sectionId: string) => {
    if (!outline) return;

    const updatedSections = outline.sections.map((section) =>
      section.id === sectionId ? { ...section, title: editedTitle } : section
    );

    const updatedOutline = { ...outline, sections: updatedSections };
    setOutline(updatedOutline);
    dispatch({
      type: 'UPDATE_PODCAST_STATE',
      payload: { outline: updatedOutline }
    });

    setEditingSection(null);
    setEditedTitle('');
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditedTitle('');
  };

  const handleAddSection = () => {
    if (!outline) return;

    const newSection: OutlineSection = {
      id: `section-${Date.now()}`,
      title: t('outline.newSection'),
      keyPoints: [],
      duration: 60
    };

    const updatedOutline = {
      ...outline,
      sections: [...outline.sections, newSection]
    };

    setOutline(updatedOutline);
    dispatch({
      type: 'UPDATE_PODCAST_STATE',
      payload: { outline: updatedOutline }
    });
  };

  const handleRemoveSection = (sectionId: string) => {
    if (!outline) return;

    const updatedSections = outline.sections.filter((section) => section.id !== sectionId);
    const updatedOutline = { ...outline, sections: updatedSections };

    setOutline(updatedOutline);
    dispatch({
      type: 'UPDATE_PODCAST_STATE',
      payload: { outline: updatedOutline }
    });
  };

  const handleProceedToScript = () => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'script' });
  };

  if (!podcastState.research) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="rounded-md p-6 espresso-warning">
          <h2 className="text-xl font-semibold mb-2">{t('outline.noResearchTitle')}</h2>
          <p className="mb-4">{t('outline.noResearchDescription')}</p>
          <button
            onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'research' })}
            className="px-4 py-2 font-medium rounded-md espresso-btn-primary"
          >
            {t('outline.backToResearch')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">{t('outline.title')}</h2>

      {!outline ? (
        <div className="mb-6">
          <button
            onClick={handleGenerateOutline}
            disabled={isGenerating}
            className={`px-6 py-3 rounded-md font-medium transition-all ${
              isGenerating
                ? 'espresso-btn-secondary cursor-not-allowed opacity-70'
                : 'espresso-btn-primary'
            }`}
          >
            {isGenerating ? t('outline.generating') : t('outline.generate')}
          </button>
        </div>
      ) : (
        <div className="mb-6">
          <div className="espresso-card rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-2">
              {outline.title}
            </h3>
            <p className="espresso-muted mb-4">{outline.description}</p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRefineOutline}
                disabled={isRefining}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  isRefining
                    ? 'espresso-btn-secondary cursor-not-allowed opacity-70'
                    : 'espresso-btn-primary'
                }`}
              >
                {isRefining ? t('outline.refining') : t('outline.refine')}
              </button>

              <button
                onClick={handleAddSection}
                className="px-4 py-2 font-medium rounded-md text-sm espresso-btn-secondary"
              >
                {t('outline.addSection')}
              </button>
            </div>
          </div>

          <div className="espresso-card rounded-lg p-6">
            <h4 className="text-lg font-medium mb-4">{t('outline.sections')}</h4>
            <div className="space-y-4">
              {outline.sections.map((section) => (
                <div key={section.id} className="rounded-md p-4 espresso-card-soft">
                  {editingSection === section.id ? (
                    <div className="mb-3">
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-md mb-2 espresso-input"
                        placeholder={t('outline.sectionTitlePlaceholder')}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveSectionTitle(section.id)}
                          className="px-3 py-1 text-sm rounded-md espresso-btn-primary"
                        >
                          {t('outline.save')}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-sm rounded-md espresso-btn-secondary"
                        >
                          {t('outline.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start mb-3">
                      <h5 className="font-medium">{section.title}</h5>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSectionTitle(section.id, section.title)}
                          className="px-2 py-1 text-xs rounded-md espresso-btn-secondary"
                        >
                          {t('outline.edit')}
                        </button>
                        <button
                          onClick={() => handleRemoveSection(section.id)}
                          className="px-2 py-1 text-xs rounded-md espresso-btn-danger"
                        >
                          {t('outline.delete')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="text-sm espresso-muted">
                    <p>{t('outline.estimatedTime', { minutes: Math.floor(section.duration / 60), seconds: section.duration % 60 })}</p>
                    {section.keyPoints.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">{t('outline.keyPoints')}</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {section.keyPoints.map((point, idx) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(error || localError) && (
        <div className="mb-6 p-4 rounded-md espresso-error">
          <p>{error || localError}</p>
        </div>
      )}

      {(isGenerating || isRefining) && (
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
              <h3 className="text-xl font-semibold text-white mb-2">
                {isRefining ? t('outline.loadingRefining') : t('outline.loadingGenerating')}
              </h3>
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

      {outline && (
        <div className="mt-6">
          <button
            onClick={handleProceedToScript}
            className="px-6 py-3 font-medium rounded-md espresso-btn-primary"
          >
            {t('outline.toScript')}
          </button>
        </div>
      )}
    </div>
  );
};

export default OutlinePanel;
