import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { PerplexityService } from '../services/perplexityService';
import { ResearchResult } from '../types';

const ResearchPanel: React.FC = () => {
  const {
    apiKeys,
    topic,
    isLoading,
    error,
    dispatch,
    podcastState,
    config,
  } = useAppContext();

  const [researchTopic, setResearchTopic] = useState(topic || '');
  const [isResearching, setIsResearching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleStartResearch = async () => {
    if (!researchTopic.trim()) {
      setLocalError('Please enter a topic to research.');
      return;
    }
    if (!apiKeys.perplexityKey) {
      setLocalError('Please set your Perplexity API key first (click the settings icon).');
      return;
    }

    try {
      setIsResearching(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const perplexityService = new PerplexityService(apiKeys.perplexityKey);
      const result: ResearchResult = await perplexityService.researchTopic(researchTopic, config.language);

      dispatch({
        type: 'UPDATE_PODCAST_STATE',
        payload: { research: result, topic: researchTopic },
      });
      dispatch({ type: 'SET_TOPIC', payload: researchTopic });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred during research.';
      setLocalError(msg);
      dispatch({ type: 'SET_ERROR', payload: msg });
      dispatch({ type: 'SET_LOADING', payload: false });
    } finally {
      setIsResearching(false);
    }
  };

  const handleCopyResults = () => {
    if (!podcastState.research) return;
    const text = [
      `Topic: ${podcastState.research.topic}`,
      '',
      'Summary:',
      podcastState.research.summary,
      '',
      'Key Points:',
      ...podcastState.research.keyPoints.map((p, i) => `${i + 1}. ${p}`),
      '',
      'Sources:',
      ...podcastState.research.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
  };

  const displayError = localError || error;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Topic input + config */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Research Your Topic</h2>
        <p className="text-slate-400 text-sm mb-6">
          Enter a topic and configure your podcast, then click Research.
        </p>

        {/* Topic input */}
        <div className="mb-5">
          <label htmlFor="researchTopic" className="block text-sm font-medium text-slate-300 mb-2">
            Podcast Topic
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              id="researchTopic"
              value={researchTopic}
              onChange={(e) => setResearchTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isResearching && handleStartResearch()}
              className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g. How does quantum computing work?"
              disabled={isResearching}
            />
            <button
              onClick={handleStartResearch}
              disabled={isResearching || !researchTopic.trim()}
              className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                isResearching || !researchTopic.trim()
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isResearching ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Researching…
                </span>
              ) : (
                'Research'
              )}
            </button>
          </div>
        </div>

        {/* Config options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Language</label>
            <select
              value={config.language}
              onChange={(e) =>
                dispatch({
                  type: 'SET_CONFIG',
                  payload: { ...config, language: e.target.value as 'en' | 'zh-TW' },
                })
              }
              disabled={isResearching}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="en">English</option>
              <option value="zh-TW">繁體中文</option>
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Format</label>
            <select
              value={config.format}
              onChange={(e) =>
                dispatch({
                  type: 'SET_CONFIG',
                  payload: { ...config, format: e.target.value as 'solo' | 'dialogue' },
                })
              }
              disabled={isResearching}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="dialogue">Host + Expert Dialogue</option>
              <option value="solo">Solo Narrator</option>
            </select>
          </div>

          {/* Length */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Length</label>
            <select
              value={config.length}
              onChange={(e) =>
                dispatch({
                  type: 'SET_CONFIG',
                  payload: { ...config, length: e.target.value as 'short' | 'medium' | 'long' },
                })
              }
              disabled={isResearching}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="short">Short (~5 min)</option>
              <option value="medium">Medium (~15 min)</option>
              <option value="long">Long (~30 min)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {displayError && !isResearching && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
          {displayError}
        </div>
      )}

      {/* Loading spinner */}
      {(isLoading || isResearching) && (
        <div className="mb-6 flex flex-col items-center justify-center p-10 bg-white/5 rounded-2xl border border-white/10">
          <svg className="animate-spin h-10 w-10 text-indigo-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-300 font-medium">Researching your topic…</p>
          <p className="text-slate-500 text-sm mt-1">This may take up to a minute.</p>
        </div>
      )}

      {/* Research results */}
      {podcastState.research && !isResearching && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">Research Results</h3>
            <button
              onClick={handleCopyResults}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Copy
            </button>
          </div>

          {/* Summary */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-3">Summary</h4>
            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{podcastState.research.summary}</p>
          </div>

          {/* Key Points */}
          {podcastState.research.keyPoints.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-3">Key Points</h4>
              <ul className="space-y-2">
                {podcastState.research.keyPoints.map((point, index) => (
                  <li key={index} className="flex gap-2 text-slate-300">
                    <span className="text-indigo-400 font-bold flex-shrink-0">{index + 1}.</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          {podcastState.research.sources.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-3">Sources</h4>
              <ul className="space-y-4">
                {podcastState.research.sources.map((source, index) => (
                  <li key={index} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                    <p className="font-medium text-white">{source.title}</p>
                    {source.snippet && (
                      <p className="text-sm text-slate-400 mt-1">{source.snippet}</p>
                    )}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 text-sm mt-1 inline-block truncate max-w-full"
                    >
                      {source.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'outline' })}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Generate Outline →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchPanel;
