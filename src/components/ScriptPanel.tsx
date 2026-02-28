import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { Dialogue, Script } from '../types';
import {
  getMissingProviderKeys,
  getProviderDisplayName,
  LlmWorkflowService
} from '../services/llmWorkflowService';

const ScriptPanel: React.FC = () => {
  const {
    apiKeys,
    config,
    podcastState,
    isLoading,
    dispatch
  } = useAppContext();
  const { t } = useI18n();

  const [editingDialogueId, setEditingDialogueId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedInitialGeneration, setHasAttemptedInitialGeneration] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setError(null);
  }, []);
  const missingProviders = getMissingProviderKeys(apiKeys, config);
  const hasMissingProviderKeys = missingProviders.length > 0;

  const generateScript = useCallback(async () => {
    if (!podcastState.outline || !podcastState.research) {
      setError(t('script.error.missingGenerateInfo'));
      return;
    }

    if (hasMissingProviderKeys) {
      setError(
        t('llm.error.missingProviderKeys', {
          providers: missingProviders.map((provider) => getProviderDisplayName(provider)).join(', ')
        })
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    setHasAttemptedInitialGeneration(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const workflowService = new LlmWorkflowService({ apiKeys, config });
      const { result: script, provider, usedFallback } = await workflowService.generatePodcastScript(
        podcastState.outline,
        podcastState.research,
        { signal: abortController.signal }
      );

      dispatch({ type: 'SET_SCRIPT', payload: script });
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

      if (usedFallback) {
        setError(
          t('llm.info.fallbackUsed', {
            provider: getProviderDisplayName(provider)
          })
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Script generation canceled by user');
        return;
      }
      console.error('Error generating script:', err);
      setError(err instanceof Error ? err.message : t('script.error.generateUnknown'));
    } finally {
      setIsGenerating(false);
    }
  }, [
    apiKeys,
    config,
    dispatch,
    hasMissingProviderKeys,
    missingProviders,
    podcastState.outline,
    podcastState.research,
    t
  ]);

  const regenerateSection = useCallback(async (sectionId: string) => {
    if (!podcastState.script || !podcastState.research || !podcastState.outline) {
      setError(t('script.error.missingRegenerateInfo'));
      return;
    }

    if (hasMissingProviderKeys) {
      setError(
        t('llm.error.missingProviderKeys', {
          providers: missingProviders.map((provider) => getProviderDisplayName(provider)).join(', ')
        })
      );
      return;
    }

    setIsGenerating(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const section = podcastState.outline?.sections.find((s) => s.id === sectionId);

      if (!section) {
        throw new Error(t('script.error.sectionNotFound'));
      }

      const sectionDialogues = podcastState.script.dialogues.filter((d) =>
        podcastState.script?.sections.find((s) => s.id === sectionId)?.dialogueIds.includes(d.id)
      );

      const previousContext = sectionDialogues.slice(0, 2).map((d) =>
        `[${d.speaker === 'host' ? '主持人' : '專家'}] ${d.text}`
      ).join('\n');

      const workflowService = new LlmWorkflowService({ apiKeys, config });
      const { result: newDialogues }: { result: Dialogue[] } =
        await workflowService.generateSectionDialogue({
          outline: podcastState.outline,
          section,
          research: podcastState.research,
          previousContext,
          currentScript: podcastState.script
        }, { signal: abortController.signal });

      const updatedDialogues = [...podcastState.script.dialogues];
      const sectionStartIndex = updatedDialogues.findIndex((d) =>
        sectionDialogues.length > 0 ? d.id === sectionDialogues[0].id : false
      );

      if (sectionStartIndex !== -1) {
        updatedDialogues.splice(sectionStartIndex, sectionDialogues.length);
        updatedDialogues.splice(sectionStartIndex, 0, ...newDialogues);
      } else {
        updatedDialogues.push(...newDialogues);
      }

      const updatedSections = podcastState.script.sections.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            dialogueIds: newDialogues.map((d) => d.id)
          };
        }
        return s;
      });

      const updatedScript: Script = {
        ...podcastState.script,
        dialogues: updatedDialogues,
        sections: updatedSections
      };

      dispatch({ type: 'UPDATE_SCRIPT', payload: updatedScript });
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
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Section regeneration canceled by user');
        return;
      }
      console.error('Error regenerating section:', err);
      setError(err instanceof Error ? err.message : t('script.error.regenerateUnknown'));
    } finally {
      setIsGenerating(false);
    }
  }, [
    apiKeys,
    config,
    dispatch,
    hasMissingProviderKeys,
    missingProviders,
    podcastState.outline,
    podcastState.research,
    podcastState.script,
    t
  ]);

  const refineScript = useCallback(async () => {
    if (!podcastState.script || !podcastState.research || !podcastState.outline || !feedback.trim()) {
      setError(t('script.error.missingRefineInfo'));
      return;
    }

    if (hasMissingProviderKeys) {
      setError(
        t('llm.error.missingProviderKeys', {
          providers: missingProviders.map((provider) => getProviderDisplayName(provider)).join(', ')
        })
      );
      return;
    }

    setIsGenerating(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const workflowService = new LlmWorkflowService({ apiKeys, config });
      const { result: refinedScript }: { result: Script } = await workflowService.refineScript({
        outline: podcastState.outline,
        research: podcastState.research,
        script: podcastState.script,
        feedback
      }, { signal: abortController.signal });

      dispatch({ type: 'UPDATE_SCRIPT', payload: refinedScript });
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
      setFeedback('');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Script refinement canceled by user');
        return;
      }
      console.error('Error refining script:', err);
      setError(err instanceof Error ? err.message : t('script.error.refineUnknown'));
    } finally {
      setIsGenerating(false);
    }
  }, [
    apiKeys,
    config,
    dispatch,
    feedback,
    hasMissingProviderKeys,
    missingProviders,
    podcastState.outline,
    podcastState.research,
    podcastState.script,
    t
  ]);

  const startEditing = (dialogue: Dialogue) => {
    setEditingDialogueId(dialogue.id);
    setEditingText(dialogue.text);
  };

  const saveEdit = () => {
    if (!editingDialogueId || !podcastState.script) return;

    const updatedDialogues = podcastState.script.dialogues.map((dialogue) =>
      dialogue.id === editingDialogueId
        ? { ...dialogue, text: editingText }
        : dialogue
    );

    const updatedScript: Script = {
      ...podcastState.script,
      dialogues: updatedDialogues
    };

    dispatch({ type: 'UPDATE_SCRIPT', payload: updatedScript });
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
    setEditingDialogueId(null);
    setEditingText('');
  };

  const cancelEdit = () => {
    setEditingDialogueId(null);
    setEditingText('');
  };

  const calculateDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!hasAttemptedInitialGeneration && !podcastState.script && podcastState.outline && podcastState.research && !hasMissingProviderKeys) {
      generateScript();
    }
  }, [
    generateScript,
    hasAttemptedInitialGeneration,
    hasMissingProviderKeys,
    podcastState.outline,
    podcastState.research,
    podcastState.script
  ]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t('script.title')}</h1>
        <p className="espresso-muted">
          {t('script.subtitle')}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl espresso-error">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="espresso-muted hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!podcastState.script && (
        <div className="mb-8">
          <button
            onClick={generateScript}
            disabled={isGenerating || hasMissingProviderKeys}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              isGenerating || hasMissingProviderKeys
                ? 'espresso-btn-secondary cursor-not-allowed opacity-70'
                : 'espresso-btn-primary'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('script.generating')}
              </span>
            ) : (
              t('script.generate')
            )}
          </button>

          {hasMissingProviderKeys && (
            <p className="mt-2 text-sm text-[#f9e2af]">
              {t('llm.error.missingProviderKeys', {
                providers: missingProviders.map((provider) => getProviderDisplayName(provider)).join(', ')
              })}
            </p>
          )}
        </div>
      )}

      {podcastState.script && (
        <div className="space-y-8">
          <div className="espresso-card rounded-2xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{podcastState.script.title}</h2>
                <p className="espresso-muted">
                  {t('script.estimatedDuration', { duration: calculateDuration(podcastState.script.totalDuration) })}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={generateScript}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isGenerating
                      ? 'espresso-btn-secondary cursor-not-allowed opacity-70'
                      : 'espresso-btn-primary'
                  }`}
                >
                  {t('script.regenerate')}
                </button>

                <button
                  onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'audio' })}
                  className="px-4 py-2 rounded-lg font-medium transition-all espresso-btn-secondary"
                >
                  {t('script.toAudio')}
                </button>
              </div>
            </div>
          </div>

          <div className="espresso-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('script.refineTitle')}</h3>
            <div className="flex space-x-3">
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={t('script.feedbackPlaceholder')}
                className="flex-1 px-4 py-2 rounded-lg espresso-input"
              />
              <button
                onClick={refineScript}
                disabled={isGenerating || !feedback.trim()}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  isGenerating || !feedback.trim()
                    ? 'espresso-btn-secondary cursor-not-allowed opacity-70'
                    : 'espresso-btn-primary'
                }`}
              >
                {isGenerating ? t('script.processing') : t('script.refine')}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {podcastState.script.sections.map((section) => {
              const sectionDialogues = podcastState.script!.dialogues.filter((d) =>
                section.dialogueIds.includes(d.id)
              );

              return (
                <div key={section.id} className="espresso-card rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                    <button
                      onClick={() => regenerateSection(section.id)}
                      disabled={isGenerating}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                        isGenerating
                          ? 'espresso-btn-secondary cursor-not-allowed opacity-70'
                          : 'espresso-btn-secondary'
                      }`}
                    >
                      {t('script.regenerateSection')}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {sectionDialogues.map((dialogue) => (
                      <div
                        key={dialogue.id}
                        className={`p-4 rounded-lg ${
                          dialogue.speaker === 'host'
                            ? 'bg-[#313244] border-l-4 border-[#b4befe]'
                            : 'bg-[#45475a] border-l-4 border-[#74c7ec]'
                        }`}
                      >
                        {editingDialogueId === dialogue.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full px-3 py-2 rounded-md espresso-input"
                              rows={3}
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={saveEdit}
                                className="px-3 py-1 rounded-md text-sm font-medium espresso-btn-primary"
                              >
                                {t('script.save')}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 rounded-md text-sm font-medium espresso-btn-secondary"
                              >
                                {t('script.cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex justify-between items-start">
                              <span className={`font-semibold ${
                                dialogue.speaker === 'host' ? 'text-[#b4befe]' : 'text-[#89b4fa]'
                              }`}>
                                {dialogue.speaker === 'host' ? t('script.speaker.host') : t('script.speaker.expert')}
                              </span>
                              {dialogue.emotion && (
                                <span className="text-xs px-2 py-1 rounded-full espresso-card-soft espresso-muted">
                                  {dialogue.emotion === 'curious' && t('script.emotion.curious')}
                                  {dialogue.emotion === 'excited' && t('script.emotion.excited')}
                                  {dialogue.emotion === 'thoughtful' && t('script.emotion.thoughtful')}
                                  {dialogue.emotion === 'neutral' && t('script.emotion.neutral')}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-white">{dialogue.text}</p>
                            <button
                              onClick={() => startEditing(dialogue)}
                              className="mt-2 text-sm espresso-muted hover:text-white transition-colors"
                            >
                              {t('script.edit')}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(isLoading || isGenerating) && (
        <div 
          className="fixed inset-0 espresso-overlay backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleCancel}
        >
          <div 
            className="espresso-card rounded-2xl p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-12 w-12 text-[#b4befe] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-xl font-semibold text-white mb-2">{t('script.modal.processingTitle')}</h3>
              <p className="espresso-muted text-center mb-6">
                {t('script.modal.processingDescription')}
              </p>
              
              {isGenerating && (
                <button
                  onClick={handleCancel}
                  className="px-6 py-2 rounded-lg font-medium transition-all espresso-btn-danger"
                >
                  {t('script.cancel')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptPanel;
