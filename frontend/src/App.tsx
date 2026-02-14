import React, { useEffect } from 'react';
import { useAppContext } from './contexts/AppContext';
import { Header } from './components/Header';
import { ApiKeyPanel } from './components/ApiKeyPanel';
import ResearchPanel from './components/ResearchPanel';
import OutlinePanel from './components/OutlinePanel';
import ScriptPanel from './components/ScriptPanel';
import AudioPanel from './components/AudioPanel';

function App() {
  const { 
    currentStep, 
    apiKeys, 
    error, 
    dispatch 
  } = useAppContext();
  
  const [isApiKeyPanelOpen, setIsApiKeyPanelOpen] = React.useState(false);

  // 檢查 API 金鑰是否存在
  useEffect(() => {
    if (!apiKeys.perplexityKey || !apiKeys.geminiKey) {
      setIsApiKeyPanelOpen(true);
    }
  }, [apiKeys]);

  const closeApiKeyPanel = () => {
    setIsApiKeyPanelOpen(false);
  };

  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <Header />
      
      {isApiKeyPanelOpen && (
        <ApiKeyPanel 
          isOpen={isApiKeyPanelOpen} 
          onClose={closeApiKeyPanel} 
        />
      )}
      
      {error && (
        <div className="fixed top-20 right-4 z-50">
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200">
            <div className="flex justify-between items-center">
              <span>{error}</span>
              <button 
                onClick={clearError}
                className="text-red-200 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 'input' && (
          <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center">
              <h2 className="text-2xl font-bold mb-4">主題輸入</h2>
              <p className="text-slate-400 mb-6">此功能將在後續版本中實現</p>
              <button 
                onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'research' })}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all"
              >
                前往研究
              </button>
            </div>
          </div>
        )}
        
        {currentStep === 'research' && <ResearchPanel />}
        
        {currentStep === 'outline' && <OutlinePanel />}
        
        {currentStep === 'script' && <ScriptPanel />}
        
        {currentStep === 'audio' && <AudioPanel />}
      </main>
    </div>
  );
}

export default App;
