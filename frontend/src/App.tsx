import React, { useEffect } from 'react';
import { useAppContext } from './contexts/AppContext';
import { Header } from './components/Header';
import { ApiKeyPanel } from './components/ApiKeyPanel';
import ResearchPanel from './components/ResearchPanel';
import OutlinePanel from './components/OutlinePanel';
import ScriptPanel from './components/ScriptPanel';
import AudioPanel from './components/AudioPanel';
import { AppStep } from './types';

const STEPS: { key: AppStep; label: string }[] = [
  { key: 'research', label: 'Research' },
  { key: 'outline', label: 'Outline' },
  { key: 'script', label: 'Script' },
  { key: 'audio', label: 'Audio' },
];

function StepIndicator({ current }: { current: AppStep }) {
  const currentIdx = STEPS.findIndex(s => s.key === current);
  return (
    <div className="flex items-center justify-center gap-2 py-4 border-b border-white/5">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active
                ? 'bg-indigo-600 text-white'
                : done
                ? 'bg-indigo-900/60 text-indigo-300'
                : 'bg-white/5 text-slate-500'
            }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                done ? 'bg-green-500 text-white' : active ? 'bg-white/30 text-white' : 'bg-white/10 text-slate-500'
              }`}>
                {done ? '✓' : idx + 1}
              </span>
              {step.label}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-6 ${idx < currentIdx ? 'bg-indigo-500' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function App() {
  const {
    currentStep,
    apiKeys,
    error,
    dispatch
  } = useAppContext();

  const [isApiKeyPanelOpen, setIsApiKeyPanelOpen] = React.useState(false);

  // Open API key panel automatically when required keys are missing
  useEffect(() => {
    if (!apiKeys.perplexityKey || !apiKeys.geminiKey) {
      setIsApiKeyPanelOpen(true);
    }
  }, [apiKeys.perplexityKey, apiKeys.geminiKey]);

  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  // 'input' was a legacy stub — redirect immediately to 'research'
  useEffect(() => {
    if (currentStep === 'input') {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'research' });
    }
  }, [currentStep, dispatch]);

  const displayStep: AppStep = currentStep === 'input' ? 'research' : currentStep;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <Header onApiKeyClick={() => setIsApiKeyPanelOpen(true)} />

      {isApiKeyPanelOpen && (
        <ApiKeyPanel
          isOpen={isApiKeyPanelOpen}
          onClose={() => setIsApiKeyPanelOpen(false)}
        />
      )}

      {error && (
        <div className="fixed top-20 right-4 z-50 max-w-sm">
          <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200">
            <div className="flex justify-between items-start gap-3">
              <span className="text-sm">{error}</span>
              <button
                onClick={clearError}
                className="text-red-200 hover:text-white transition-colors flex-shrink-0"
                aria-label="Dismiss error"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <StepIndicator current={displayStep} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {displayStep === 'research' && <ResearchPanel />}
        {displayStep === 'outline' && <OutlinePanel />}
        {displayStep === 'script' && <ScriptPanel />}
        {displayStep === 'audio' && <AudioPanel />}
      </main>
    </div>
  );
}

export default App;
