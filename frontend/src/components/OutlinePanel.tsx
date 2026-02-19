import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { PerplexityService } from '../services/perplexityService';
import { Outline, OutlineSection } from '../types';

const OutlinePanel: React.FC = () => {
  const {
    apiKeys,
    podcastState,
    isLoading,
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

  useEffect(() => {
    if (podcastState.outline) {
      setOutline(podcastState.outline);
    }
  }, [podcastState.outline]);

  const handleGenerateOutline = async () => {
    if (!podcastState.research) {
      setLocalError(t('outline.error.needResearch'));
      return;
    }

    if (!apiKeys.perplexityKey) {
      setLocalError(t('outline.error.missingPerplexity'));
      return;
    }

    try {
      setIsGenerating(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const perplexityService = new PerplexityService(apiKeys.perplexityKey);
      const result: Outline = await perplexityService.generateOutline(podcastState.research);

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

    if (!apiKeys.perplexityKey) {
      setLocalError(t('outline.error.missingPerplexity'));
      return;
    }

    try {
      setIsRefining(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const researchWithOutline = {
        ...podcastState.research!,
        summary: `${podcastState.research!.summary}\n\n${t('outline.currentOutline')}:\n${outline.title}\n${outline.description}\n${outline.sections.map((s) => `- ${s.title}`).join('\n')}`
      };

      const perplexityService = new PerplexityService(apiKeys.perplexityKey);
      const result: Outline = await perplexityService.generateOutline(researchWithOutline);

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

      {isLoading && (
        <div className="mb-6 flex flex-col items-center justify-center p-8 rounded-md espresso-card-soft">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#fab387] mb-4"></div>
          <p className="espresso-muted">
            {isRefining ? t('outline.loadingRefining') : t('outline.loadingGenerating')}
          </p>
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
