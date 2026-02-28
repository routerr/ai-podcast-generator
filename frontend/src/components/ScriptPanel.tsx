import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Dialogue, Script } from '../types';
import { GeminiService } from '../services/geminiService';

const ScriptPanel: React.FC = () => {
  const {
    apiKeys,
    podcastState,
    isLoading,
    config,
    dispatch,
  } = useAppContext();
  
  const [editingDialogueId, setEditingDialogueId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate script
  const generateScript = useCallback(async () => {
    if (!podcastState.outline || !podcastState.research || !apiKeys.geminiKey) {
      setError('Missing required information to generate the script. Please complete the research and outline steps first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const geminiService = new GeminiService();
      const script = await geminiService.generatePodcastScript(
        apiKeys.geminiKey,
        podcastState.outline,
        podcastState.research,
        config
      );
      
      dispatch({ type: 'SET_SCRIPT', payload: script });
    } catch (err) {
      console.error('Script generation error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during script generation.');
    } finally {
      setIsGenerating(false);
    }
  }, [apiKeys.geminiKey, config, dispatch, podcastState.outline, podcastState.research]);

  // Regenerate a single section
  const regenerateSection = useCallback(async (sectionId: string) => {
    if (!podcastState.script || !podcastState.research || !apiKeys.geminiKey) {
      setError('Missing required information to regenerate this section.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      const geminiService = new GeminiService();
      const section = podcastState.outline?.sections.find(s => s.id === sectionId);

      if (!section) {
        throw new Error('Section not found in outline.');
      }

      // Use first 2 existing dialogues as context
      const sectionDialogues = podcastState.script.dialogues.filter(d =>
        podcastState.script?.sections.find(s => s.id === sectionId)?.dialogueIds.includes(d.id)
      );
      const previousContext = sectionDialogues.slice(0, 2)
        .map(d => `[${d.speaker === 'host' ? 'Host' : 'Expert'}] ${d.text}`)
        .join('\n');

      const newDialogues = await geminiService.generateSectionDialogue(
        apiKeys.geminiKey,
        section,
        podcastState.research!,
        previousContext,
        config
      );

      // Replace old section dialogues with new ones
      const updatedDialogues = [...podcastState.script.dialogues];
      const sectionStartIndex = sectionDialogues.length > 0
        ? updatedDialogues.findIndex(d => d.id === sectionDialogues[0].id)
        : -1;

      if (sectionStartIndex !== -1) {
        updatedDialogues.splice(sectionStartIndex, sectionDialogues.length, ...newDialogues);
      } else {
        updatedDialogues.push(...newDialogues);
      }

      const updatedSections = podcastState.script.sections.map(s =>
        s.id === sectionId ? { ...s, dialogueIds: newDialogues.map(d => d.id) } : s
      );

      dispatch({ type: 'UPDATE_SCRIPT', payload: { ...podcastState.script, dialogues: updatedDialogues, sections: updatedSections } });
    } catch (err) {
      console.error('Section regeneration error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while regenerating the section.');
    } finally {
      setIsGenerating(false);
    }
  }, [apiKeys.geminiKey, config, dispatch, podcastState.script, podcastState.research, podcastState.outline]);

  // Refine script with user feedback
  const refineScript = useCallback(async () => {
    if (!podcastState.script || !apiKeys.geminiKey || !feedback.trim()) {
      setError('Please enter feedback to refine the script.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const geminiService = new GeminiService();
      const refinedScript = await geminiService.refineScript(
        apiKeys.geminiKey,
        podcastState.script,
        feedback,
        config
      );
      dispatch({ type: 'UPDATE_SCRIPT', payload: refinedScript });
      setFeedback('');
    } catch (err) {
      console.error('Script refinement error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during script refinement.');
    } finally {
      setIsGenerating(false);
    }
  }, [apiKeys.geminiKey, config, dispatch, podcastState.script, feedback]);

  // 開始編輯對話
  const startEditing = (dialogue: Dialogue) => {
    setEditingDialogueId(dialogue.id);
    setEditingText(dialogue.text);
  };

  // 保存編輯的對話
  const saveEdit = () => {
    if (!editingDialogueId || !podcastState.script) return;
    
    const updatedDialogues = podcastState.script.dialogues.map(dialogue => 
      dialogue.id === editingDialogueId 
        ? { ...dialogue, text: editingText } 
        : dialogue
    );
    
    const updatedScript: Script = {
      ...podcastState.script,
      dialogues: updatedDialogues
    };
    
    dispatch({ type: 'UPDATE_SCRIPT', payload: updatedScript });
    setEditingDialogueId(null);
    setEditingText('');
  };

  // 取消編輯
  const cancelEdit = () => {
    setEditingDialogueId(null);
    setEditingText('');
  };

  // 計算總時長（以分鐘為單位）
  const calculateDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Auto-generate script when arriving at this step
  useEffect(() => {
    if (!podcastState.script && podcastState.outline && podcastState.research && apiKeys.geminiKey) {
      generateScript();
    }
  }, [generateScript, podcastState.script, podcastState.outline, podcastState.research, apiKeys.geminiKey]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Podcast Script</h1>
        <p className="text-gray-400">
          Review and edit the generated dialogue script before producing audio.
        </p>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-200 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Generate button (shown before script exists) */}
      {!podcastState.script && (
        <div className="mb-8">
          <button
            onClick={generateScript}
            disabled={isGenerating || !apiKeys.geminiKey}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              isGenerating || !apiKeys.geminiKey
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Script…
              </span>
            ) : (
              'Generate Podcast Script'
            )}
          </button>

          {!apiKeys.geminiKey && (
            <p className="mt-2 text-yellow-500 text-sm">
              Please provide your Google Gemini API key in Settings.
            </p>
          )}
        </div>
      )}

      {/* 腳本內容 */}
      {podcastState.script && (
        <div className="space-y-8">
          {/* 腳本標題和時長 */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{podcastState.script.title}</h2>
                <p className="text-gray-400">
                  Duration: {calculateDuration(podcastState.script.totalDuration)}
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={generateScript}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isGenerating
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  Regenerate
                </button>

                <button
                  onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'audio' })}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
                >
                  Generate Audio →
                </button>
              </div>
            </div>
          </div>

          {/* Refine script */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Refine Script</h3>
            <div className="flex space-x-3">
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isGenerating && feedback.trim() && refineScript()}
                placeholder="Describe what to change (e.g. 'Make it more casual' or 'Add more examples')…"
                className="flex-1 px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={refineScript}
                disabled={isGenerating || !feedback.trim()}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  isGenerating || !feedback.trim()
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {isGenerating ? 'Processing…' : 'Refine'}
              </button>
            </div>
          </div>

          {/* 腳本對話內容 */}
          <div className="space-y-6">
            {podcastState.script.sections.map((section) => {
              const sectionDialogues = podcastState.script!.dialogues.filter(d => 
                section.dialogueIds.includes(d.id)
              );
              
              return (
                <div key={section.id} className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                    <button
                      onClick={() => regenerateSection(section.id)}
                      disabled={isGenerating}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                        isGenerating
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      Regenerate Section
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {sectionDialogues.map((dialogue) => (
                      <div 
                        key={dialogue.id} 
                        className={`p-4 rounded-lg ${
                          dialogue.speaker === 'host' 
                            ? 'bg-blue-500/10 border-l-4 border-blue-500' 
                            : 'bg-green-500/10 border-l-4 border-green-500'
                        }`}
                      >
                        {editingDialogueId === dialogue.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              rows={3}
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={saveEdit}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex justify-between items-start">
                              <span className={`font-semibold ${
                                dialogue.speaker === 'host' ? 'text-blue-400' : 'text-green-400'
                              }`}>
                                {dialogue.speaker === 'host' ? 'Host' : 'Expert'}
                              </span>
                              {dialogue.emotion && (
                                <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-gray-300 capitalize">
                                  {dialogue.emotion}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-white">{dialogue.text}</p>
                            <button
                              onClick={() => startEditing(dialogue)}
                              className="mt-2 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                              Edit
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

      {/* Loading overlay */}
      {(isLoading || isGenerating) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-12 w-12 text-indigo-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-xl font-semibold text-white mb-2">Working…</h3>
              <p className="text-gray-400 text-center">
                Generating your podcast script, please wait…
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptPanel;