import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useApiKeys } from '../hooks/useApiKeys';
import './ApiKeyPanel.css';

interface ApiKeyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyPanel: React.FC<ApiKeyPanelProps> = ({ isOpen, onClose }) => {
  const { apiKeys, keyStatus, savePerplexityKey, saveGeminiKey, saveOpenaiKey, clearAllKeys } = useApiKeys();
  const [perplexityKey, setPerplexityKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState(''); // 新增 OpenAI API 金鑰狀態
  const [showPerplexityKey, setShowPerplexityKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false); // 新增 OpenAI 金鑰顯示狀態

  // 初始化時從 hook 獲取現有金鑰
  useEffect(() => {
    if (isOpen) {
      setPerplexityKey(apiKeys.perplexityKey);
      setGeminiKey(apiKeys.geminiKey);
      setOpenaiKey(apiKeys.openaiKey || ''); // 初始化 OpenAI 金鑰
    }
  }, [isOpen, apiKeys]);

  // 保存 Perplexity API 金鑰
  const handleSavePerplexityKey = () => {
    if (perplexityKey.trim()) {
      savePerplexityKey(perplexityKey.trim());
    }
  };

  // 保存 Gemini API 金鑰
  const handleSaveGeminiKey = () => {
    if (geminiKey.trim()) {
      saveGeminiKey(geminiKey.trim());
    }
  };

  // 保存 OpenAI API 金鑰
  const handleSaveOpenaiKey = () => {
    if (openaiKey.trim()) {
      saveOpenaiKey(openaiKey.trim());
    }
  };

  // 清除所有金鑰
  const handleClearAllKeys = () => {
    clearAllKeys();
    setPerplexityKey('');
    setGeminiKey('');
    setOpenaiKey(''); // 清除 OpenAI 金鑰
  };

  // 渲染金鑰狀態指示器
  const renderKeyStatus = (isValid: boolean | null) => {
    if (isValid === null) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
    
    return isValid ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">API Key Settings</h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Perplexity API Key */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">
                Perplexity API Key
              </label>
              
              <div className="relative">
                <input
                  type={showPerplexityKey ? "text" : "password"}
                  value={perplexityKey}
                  onChange={(e) => setPerplexityKey(e.target.value)}
                  placeholder="Enter your Perplexity API key"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                
                <button
                  type="button"
                  onClick={() => setShowPerplexityKey(!showPerplexityKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  aria-label={showPerplexityKey ? "Hide key" : "Show key"}
                >
                  {showPerplexityKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderKeyStatus(keyStatus.perplexityValid)}
                  <span className="text-sm text-slate-400">
                    {keyStatus.perplexityValid === null
                      ? 'Not validated'
                      : keyStatus.perplexityValid
                      ? 'Valid key'
                      : 'Invalid or empty'}
                  </span>
                </div>
                
                <button
                  onClick={handleSavePerplexityKey}
                  disabled={!perplexityKey.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Google Gemini API Key */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">
                Google Gemini API Key
              </label>
              
              <div className="relative">
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="Enter your Google Gemini API key"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  aria-label={showGeminiKey ? "Hide key" : "Show key"}
                >
                  {showGeminiKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderKeyStatus(keyStatus.geminiValid)}
                  <span className="text-sm text-slate-400">
                    {keyStatus.geminiValid === null
                      ? 'Not validated'
                      : keyStatus.geminiValid
                      ? 'Valid key'
                      : 'Invalid or empty'}
                  </span>
                </div>
                
                <button
                  onClick={handleSaveGeminiKey}
                  disabled={!geminiKey.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {/* OpenAI API Key (for high-quality TTS) */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">
                OpenAI API Key (Optional - for high-quality TTS)
              </label>
              
              <div className="relative">
                <input
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="Enter your OpenAI API key for high-quality audio"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  aria-label={showOpenaiKey ? "Hide key" : "Show key"}
                >
                  {showOpenaiKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderKeyStatus(keyStatus.openaiValid)}
                  <span className="text-sm text-slate-400">
                    {keyStatus.openaiValid === null
                      ? 'Not validated'
                      : keyStatus.openaiValid
                      ? 'Valid key'
                      : 'Invalid or empty'}
                  </span>
                </div>
                
                <button
                  onClick={handleSaveOpenaiKey}
                  disabled={!openaiKey.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Clear All Keys Button */}
            <div className="pt-4">
              <button
                onClick={handleClearAllKeys}
                className="w-full py-2 px-4 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-300 rounded-lg text-sm font-medium transition-colors"
              >
                Clear All API Keys
              </button>
              
              <p className="mt-3 text-xs text-slate-400">
                API keys are stored locally in your browser and never sent to any server.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};