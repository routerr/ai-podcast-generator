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
    podcastState
  } = useAppContext();
  
  const [researchTopic, setResearchTopic] = useState(topic || '');
  const [isResearching, setIsResearching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleStartResearch = async () => {
    if (!researchTopic.trim()) {
      setLocalError('請輸入研究主題');
      return;
    }

    if (!apiKeys.perplexityKey) {
      setLocalError('請先設定 Perplexity API 金鑰');
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
          topic: researchTopic
        } 
      });
      
      dispatch({ type: 'SET_TOPIC', payload: researchTopic });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '研究過程中發生未知錯誤';
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
主題: ${podcastState.research.topic}

摘要:
${podcastState.research.summary}

關鍵要點:
${podcastState.research.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

來源:
${podcastState.research.sources.map((source, i) => `${i + 1}. ${source.title} - ${source.url}`).join('\n')}
      `.trim();
      
      navigator.clipboard.writeText(textToCopy);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">研究主題</h2>
      
      <div className="mb-6">
        <label htmlFor="researchTopic" className="block text-sm font-medium text-gray-700 mb-2">
          輸入播客主題
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            id="researchTopic"
            value={researchTopic}
            onChange={(e) => setResearchTopic(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="例如：人工智慧的未來發展趨勢"
            disabled={isResearching}
          />
          <button
            onClick={handleStartResearch}
            disabled={isResearching}
            className={`px-6 py-2 rounded-md font-medium ${
              isResearching
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isResearching ? '研究中...' : '開始研究'}
          </button>
        </div>
      </div>

      {(error || localError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error || localError}</p>
        </div>
      )}

      {isLoading && (
        <div className="mb-6 flex flex-col items-center justify-center p-8 bg-gray-50 rounded-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">正在進行研究，請稍候...</p>
        </div>
      )}

      {podcastState.research && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">研究結果</h3>
            <button
              onClick={handleCopyResults}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-medium"
            >
              複製結果
            </button>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
            <h4 className="text-lg font-medium mb-3">摘要</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{podcastState.research.summary}</p>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
            <h4 className="text-lg font-medium mb-3">關鍵要點</h4>
            <ul className="list-disc pl-5 space-y-2">
              {podcastState.research.keyPoints.map((point, index) => (
                <li key={index} className="text-gray-700">{point}</li>
              ))}
            </ul>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h4 className="text-lg font-medium mb-3">來源</h4>
            <ul className="space-y-3">
              {podcastState.research.sources.map((source, index) => (
                <li key={index} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <h5 className="font-medium text-gray-900">{source.title}</h5>
                  <p className="text-sm text-gray-600 mt-1">{source.snippet}</p>
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm mt-1 inline-block"
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
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md"
            >
              生成大綱
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchPanel;