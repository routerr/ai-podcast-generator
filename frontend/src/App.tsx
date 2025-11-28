import React, { useState, useEffect, useRef } from 'react';
import { Mic, Play, Pause, Download, Loader2, MessageCircle, User, Radio, Globe, Clock, ChevronRight } from 'lucide-react';

// Types
interface Question {
  question_id: string;
  question: string;
  options: { key: string; text: string }[];
}

interface SessionConfig {
  language: 'en' | 'zh-TW';
  format: 'solo' | 'dialogue';
  length: 'short' | 'medium' | 'long';
}

interface ProgressUpdate {
  session_id: string;
  progress: number;
  step: string;
  message: string;
}

// API URL from environment or default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Main App Component
export default function App() {
  // State
  const [step, setStep] = useState<'input' | 'questions' | 'config' | 'generating' | 'complete'>('input');
  const [topic, setTopic] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<SessionConfig>({
    language: 'en',
    format: 'dialogue',
    length: 'medium'
  });
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Start session with topic
  const handleStartSession = async () => {
    if (!topic.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() })
      });
      
      if (!response.ok) throw new Error('Failed to start session');
      
      const data = await response.json();
      setSessionId(data.session_id);
      setQuestions(data.questions || []);
      setStep('questions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit answers and move to config
  const handleAnswersComplete = async () => {
    if (!sessionId) return;
    
    // Submit all answers
    for (const [questionId, answer] of Object.entries(answers)) {
      await fetch(`${API_URL}/api/session/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question_id: questionId, answer })
      });
    }
    
    setStep('config');
  };

  // Configure and start generation
  const handleStartGeneration = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Submit configuration
      await fetch(`${API_URL}/api/session/${sessionId}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          ...config
        })
      });
      
      // Connect WebSocket for progress updates
      connectWebSocket();
      
      // Start generation
      await fetch(`${API_URL}/api/session/${sessionId}/generate`, {
        method: 'POST'
      });
      
      setStep('generating');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation');
    } finally {
      setIsLoading(false);
    }
  };

  // WebSocket connection for progress updates
  const connectWebSocket = () => {
    if (!sessionId) return;
    
    const ws = new WebSocket(`ws://${API_URL.replace('http://', '')}/ws/${sessionId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
      
      if (data.step === 'completed') {
        setAudioUrl(`${API_URL}/api/session/${sessionId}/audio`);
        setStep('complete');
        ws.close();
      } else if (data.step === 'error') {
        setError(data.message);
        ws.close();
      }
    };
    
    ws.onerror = () => {
      // Fallback to polling if WebSocket fails
      startPolling();
    };
    
    wsRef.current = ws;
  };

  // Fallback polling for progress
  const startPolling = () => {
    if (!sessionId) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/session/${sessionId}/status`);
        const data = await response.json();
        
        if (data.status === 'completed') {
          setAudioUrl(`${API_URL}/api/session/${sessionId}/audio`);
          setStep('complete');
          clearInterval(interval);
        } else if (data.status === 'error') {
          setError('Generation failed');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  // Audio controls
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Reset to start over
  const handleReset = () => {
    setStep('input');
    setTopic('');
    setSessionId(null);
    setQuestions([]);
    setAnswers({});
    setProgress(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setError(null);
    if (wsRef.current) wsRef.current.close();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-xl">
            <Radio className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Podcast Generator</h1>
            <p className="text-sm text-slate-400">Transform any topic into an engaging podcast</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200">
            {error}
          </div>
        )}

        {/* Step 1: Topic Input */}
        {step === 'input' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">What do you want to learn about?</h2>
              <p className="text-slate-400">Enter any topic and I'll create a podcast for you</p>
            </div>
            
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., How does quantum computing work? / 什麼是區塊鏈技術？"
                className="w-full bg-transparent text-lg placeholder-slate-500 outline-none resize-none h-24"
              />
              
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleStartSession}
                  disabled={!topic.trim() || isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Clarifying Questions */}
        {step === 'questions' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Let me understand better...</h2>
              <p className="text-slate-400">Answer a few questions to personalize your podcast</p>
            </div>
            
            {questions.map((q, idx) => (
              <div key={q.question_id} className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <p className="font-medium mb-4">{idx + 1}. {q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setAnswers({ ...answers, [q.question_id]: opt.key })}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        answers[q.question_id] === opt.key
                          ? 'bg-purple-500/30 border-purple-500'
                          : 'bg-white/5 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <span className="font-mono text-purple-400 mr-2">{opt.key}.</span>
                      {opt.text}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="flex justify-end">
              <button
                onClick={handleAnswersComplete}
                disabled={Object.keys(answers).length < questions.length}
                className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Configuration */}
        {step === 'config' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Customize your podcast</h2>
              <p className="text-slate-400">Choose your preferences</p>
            </div>
            
            {/* Language */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-5 h-5 text-purple-400" />
                <h3 className="font-medium">Language</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'en', label: 'English' },
                  { value: 'zh-TW', label: '繁體中文' }
                ].map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => setConfig({ ...config, language: lang.value as 'en' | 'zh-TW' })}
                    className={`p-4 rounded-xl border transition-all ${
                      config.language === lang.value
                        ? 'bg-purple-500/30 border-purple-500'
                        : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Format */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="w-5 h-5 text-purple-400" />
                <h3 className="font-medium">Format</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'solo', label: 'Single Narrator', icon: User },
                  { value: 'dialogue', label: 'Host + Expert', icon: MessageCircle }
                ].map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => setConfig({ ...config, format: fmt.value as 'solo' | 'dialogue' })}
                    className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      config.format === fmt.value
                        ? 'bg-purple-500/30 border-purple-500'
                        : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <fmt.icon className="w-5 h-5" />
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Length */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-purple-400" />
                <h3 className="font-medium">Length</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'short', label: '~5 min' },
                  { value: 'medium', label: '~15 min' },
                  { value: 'long', label: '~30 min' }
                ].map((len) => (
                  <button
                    key={len.value}
                    onClick={() => setConfig({ ...config, length: len.value as 'short' | 'medium' | 'long' })}
                    className={`p-4 rounded-xl border transition-all ${
                      config.length === len.value
                        ? 'bg-purple-500/30 border-purple-500'
                        : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {len.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleStartGeneration}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 rounded-xl font-medium transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
                Generate Podcast
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Generating */}
        {step === 'generating' && (
          <div className="text-center space-y-6">
            <div className="inline-flex p-6 bg-purple-500/20 rounded-full mb-4">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
            
            <h2 className="text-2xl font-bold">Creating your podcast...</h2>
            
            {progress && (
              <div className="max-w-md mx-auto space-y-4">
                <div className="bg-white/5 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${Math.max(0, progress.progress)}%` }}
                  />
                </div>
                <p className="text-slate-400">{progress.message}</p>
              </div>
            )}
            
            <p className="text-sm text-slate-500">This may take a few minutes...</p>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && audioUrl && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">🎉 Your podcast is ready!</h2>
              <p className="text-slate-400">Topic: {topic}</p>
            </div>
            
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={togglePlayPause}
                  className="p-6 bg-purple-500 hover:bg-purple-600 rounded-full transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8" />
                  ) : (
                    <Play className="w-8 h-8 ml-1" />
                  )}
                </button>
                
                <a
                  href={audioUrl}
                  download={`podcast-${sessionId}.mp3`}
                  className="p-4 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <Download className="w-6 h-6" />
                </a>
              </div>
              
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>
            
            <div className="text-center">
              <button
                onClick={handleReset}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                Create another podcast →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
