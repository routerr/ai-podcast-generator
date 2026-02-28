import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { PerplexityService } from '../services/perplexityService';
import { Outline, OutlineSection } from '../types';

const OutlinePanel: React.FC = () => {
  const {
    apiKeys,
    podcastState,
    isLoading,
    error,
    dispatch,
    config,
  } = useAppContext();

  const [outline, setOutline] = useState<Outline | null>(podcastState.outline || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');

  // Sync local outline state with context
  useEffect(() => {
    if (podcastState.outline) {
      setOutline(podcastState.outline);
    }
  }, [podcastState.outline]);

  const handleGenerateOutline = async () => {
    if (!podcastState.research) {
      setLocalError('Please complete the research step first.');
      return;
    }
    if (!apiKeys.perplexityKey) {
      setLocalError('Please set your Perplexity API key first.');
      return;
    }

    try {
      setIsGenerating(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const perplexityService = new PerplexityService(apiKeys.perplexityKey);
      const result: Outline = await perplexityService.generateOutline(podcastState.research, config.language);

      setOutline(result);
      dispatch({ type: 'UPDATE_PODCAST_STATE', payload: { outline: result } });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred while generating the outline.';
      setLocalError(msg);
      dispatch({ type: 'SET_ERROR', payload: msg });
      dispatch({ type: 'SET_LOADING', payload: false });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineOutline = async () => {
    if (!outline || !podcastState.research) {
      setLocalError('No outline to refine.');
      return;
    }
    if (!apiKeys.perplexityKey) {
      setLocalError('Please set your Perplexity API key first.');
      return;
    }

    try {
      setIsRefining(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Inject current outline structure into the research summary for context
      const researchWithOutline = {
        ...podcastState.research,
        summary: `${podcastState.research.summary}\n\nCurrent outline:\n${outline.title}\n${outline.sections.map(s => `- ${s.title}`).join('\n')}`,
      };

      const perplexityService = new PerplexityService(apiKeys.perplexityKey);
      const result: Outline = await perplexityService.generateOutline(researchWithOutline, config.language);

      setOutline(result);
      dispatch({ type: 'UPDATE_PODCAST_STATE', payload: { outline: result } });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred while refining the outline.';
      setLocalError(msg);
      dispatch({ type: 'SET_ERROR', payload: msg });
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
    const updatedSections = outline.sections.map(s =>
      s.id === sectionId ? { ...s, title: editedTitle } : s
    );
    const updatedOutline = { ...outline, sections: updatedSections };
    setOutline(updatedOutline);
    dispatch({ type: 'UPDATE_PODCAST_STATE', payload: { outline: updatedOutline } });
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
      title: 'New Section',
      keyPoints: [],
      duration: 120,
    };
    const updatedOutline = { ...outline, sections: [...outline.sections, newSection] };
    setOutline(updatedOutline);
    dispatch({ type: 'UPDATE_PODCAST_STATE', payload: { outline: updatedOutline } });
  };

  const handleRemoveSection = (sectionId: string) => {
    if (!outline) return;
    const updatedOutline = { ...outline, sections: outline.sections.filter(s => s.id !== sectionId) };
    setOutline(updatedOutline);
    dispatch({ type: 'UPDATE_PODCAST_STATE', payload: { outline: updatedOutline } });
  };

  // Guard: research must exist first
  if (!podcastState.research) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-yellow-300 mb-2">Research Required</h2>
          <p className="text-yellow-200/70 mb-4">Complete the research step before generating an outline.</p>
          <button
            onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'research' })}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            ← Back to Research
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Podcast Outline</h2>
        <p className="text-slate-400 text-sm">
          {outline
            ? 'Review and edit the outline before generating the script.'
            : 'Generate an outline from your research results.'}
        </p>
      </div>

      {/* Error banner */}
      {(localError || error) && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
          {localError || error}
        </div>
      )}

      {/* Loading spinner */}
      {(isLoading || isGenerating || isRefining) && (
        <div className="mb-6 flex flex-col items-center justify-center p-10 bg-white/5 rounded-2xl border border-white/10">
          <svg className="animate-spin h-10 w-10 text-indigo-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-300 font-medium">
            {isRefining ? 'Refining outline…' : 'Generating outline…'}
          </p>
        </div>
      )}

      {/* No outline yet */}
      {!outline && !isGenerating && (
        <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center">
          <p className="text-slate-400 mb-6">
            Click below to generate a structured outline from your research.
          </p>
          <button
            onClick={handleGenerateOutline}
            disabled={isGenerating}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Generate Outline
          </button>
        </div>
      )}

      {/* Outline content */}
      {outline && !isGenerating && !isRefining && (
        <div className="space-y-4">
          {/* Outline header card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-2">{outline.title}</h3>
            <p className="text-slate-400 mb-5">{outline.description}</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRefineOutline}
                disabled={isRefining}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm transition-colors"
              >
                Refine Outline
              </button>
              <button
                onClick={handleAddSection}
                className="px-4 py-2 bg-green-600/80 hover:bg-green-600 text-white font-medium rounded-lg text-sm transition-colors"
              >
                + Add Section
              </button>
            </div>
          </div>

          {/* Sections list */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-4">Sections</h4>
            <div className="space-y-3">
              {outline.sections.map((section, idx) => (
                <div key={section.id} className="bg-black/20 border border-white/5 rounded-xl p-4">
                  {editingSection === section.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveSectionTitle(section.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveSectionTitle(section.id)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-300 text-sm rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-indigo-400">{idx + 1}</span>
                          <h5 className="font-medium text-white">{section.title}</h5>
                        </div>
                        <p className="text-xs text-slate-500">
                          Est. {Math.floor(section.duration / 60)}m {section.duration % 60}s
                        </p>
                        {section.keyPoints.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {section.keyPoints.map((point, pIdx) => (
                              <li key={pIdx} className="text-xs text-slate-400 flex gap-1.5">
                                <span className="text-indigo-500 flex-shrink-0">·</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4 flex-shrink-0">
                        <button
                          onClick={() => handleEditSectionTitle(section.id, section.title)}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-slate-300 text-xs rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveSection(section.id)}
                          className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'research' })}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 font-medium rounded-lg transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'script' })}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Generate Script →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutlinePanel;
