import React, { useState } from 'react';
import { Radio, Settings } from 'lucide-react';
import { ApiKeyPanel } from './ApiKeyPanel';

interface HeaderProps {
  onReset?: () => void;
  onApiKeyClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onReset, onApiKeyClick }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  return (
    <>
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <Radio className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Podcast Generator</h1>
              <p className="text-sm text-slate-400">Transform any topic into an engaging podcast</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onReset && (
              <button
                onClick={onReset}
                className="px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                Reset
              </button>
            )}
            
            <button
              onClick={onApiKeyClick || togglePanel}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="API Key Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      {isPanelOpen && (
        <ApiKeyPanel 
          isOpen={isPanelOpen} 
          onClose={() => setIsPanelOpen(false)} 
        />
      )}
    </>
  );
};