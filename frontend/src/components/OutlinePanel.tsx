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
    dispatch 
  } = useAppContext();
  
  const [outline, setOutline] = useState<Outline | null>(podcastState.outline || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');

  // 當 podcastState.outline 更新時，更新本地狀態
  useEffect(() => {
    if (podcastState.outline) {
      setOutline(podcastState.outline);
    }
  }, [podcastState.outline]);

  const handleGenerateOutline = async () => {
    if (!podcastState.research) {
      setLocalError('請先進行研究');
      return;
    }

    if (!apiKeys.perplexityKey) {
      setLocalError('請先設定 Perplexity API 金鑰');
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
        payload: { outline: result } 
      });
      
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '生成大綱時發生未知錯誤';
      setLocalError(errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_LOADING', payload: false });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineOutline = async () => {
    if (!outline) {
      setLocalError('沒有大綱可以優化');
      return;
    }

    if (!apiKeys.perplexityKey) {
      setLocalError('請先設定 Perplexity API 金鑰');
      return;
    }

    try {
      setIsRefining(true);
      setLocalError(null);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // 創建一個修改後的研究物件，包含當前的大綱
      const researchWithOutline = {
        ...podcastState.research!,
        summary: `${podcastState.research!.summary}\n\n當前大綱:\n${outline.title}\n${outline.description}\n${outline.sections.map(s => `- ${s.title}`).join('\n')}`
      };

      const perplexityService = new PerplexityService(apiKeys.perplexityKey);
      const result: Outline = await perplexityService.generateOutline(researchWithOutline);
      
      setOutline(result);
      dispatch({ 
        type: 'UPDATE_PODCAST_STATE', 
        payload: { outline: result } 
      });
      
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '優化大綱時發生未知錯誤';
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
    
    const updatedSections = outline.sections.map(section => 
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
      title: '新段落',
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
    
    const updatedSections = outline.sections.filter(section => section.id !== sectionId);
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">尚未進行研究</h2>
          <p className="text-yellow-700 mb-4">請先完成研究步驟以生成大綱。</p>
          <button
            onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'research' })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
          >
            返回研究
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">播客大綱</h2>
      
      {!outline ? (
        <div className="mb-6">
          <button
            onClick={handleGenerateOutline}
            disabled={isGenerating}
            className={`px-6 py-3 rounded-md font-medium ${
              isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isGenerating ? '生成中...' : '生成大綱'}
          </button>
        </div>
      ) : (
        <div className="mb-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-xl font-semibold mb-2">
              {outline.title}
            </h3>
            <p className="text-gray-700 mb-4">{outline.description}</p>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRefineOutline}
                disabled={isRefining}
                className={`px-4 py-2 rounded-md font-medium text-sm ${
                  isRefining
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {isRefining ? '優化中...' : '優化大綱'}
              </button>
              
              <button
                onClick={handleAddSection}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm"
              >
                新增段落
              </button>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h4 className="text-lg font-medium mb-4">段落</h4>
            <div className="space-y-4">
              {outline.sections.map((section) => (
                <div key={section.id} className="border border-gray-200 rounded-md p-4">
                  {editingSection === section.id ? (
                    <div className="mb-3">
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                        placeholder="段落標題"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveSectionTitle(section.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
                        >
                          儲存
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm rounded-md"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start mb-3">
                      <h5 className="font-medium text-gray-900">{section.title}</h5>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSectionTitle(section.id, section.title)}
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded-md"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleRemoveSection(section.id)}
                          className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded-md"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-600">
                    <p>預估時間: {Math.floor(section.duration / 60)} 分 {section.duration % 60} 秒</p>
                    {section.keyPoints.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">關鍵要點:</p>
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
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error || localError}</p>
        </div>
      )}
      
      {isLoading && (
        <div className="mb-6 flex flex-col items-center justify-center p-8 bg-gray-50 rounded-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">
            {isRefining ? '正在優化大綱...' : '正在生成大綱...'}
          </p>
        </div>
      )}
      
      {outline && (
        <div className="mt-6">
          <button
            onClick={handleProceedToScript}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md"
          >
            繼續進行腳本生成
          </button>
        </div>
      )}
    </div>
  );
};

export default OutlinePanel;