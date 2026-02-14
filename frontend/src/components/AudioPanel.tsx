import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TTSService } from '../services/ttsService';
import { AudioService } from '../services/audioService';
import { VoiceOption } from '../types';

const AudioPanel: React.FC = () => {
  const { 
    apiKeys, 
    podcastState, 
    audioState, 
    dispatch 
  } = useAppContext();
  
  const [hostVoice, setHostVoice] = useState<string>(''); // 主持人聲音
  const [expertVoice, setExpertVoice] = useState<string>(''); // 專家聲音
  const [rate, setRate] = useState<number>(1.0); // 語速
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]); // 可用語音列表
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false); // 預覽播放狀態
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null); // 預覽音訊元素
  
  // 初始化語音選項
  useEffect(() => {
    const initializeVoices = () => {
      // 獲取瀏覽器支援的語音
      const browserVoices = speechSynthesis.getVoices().map(voice => ({
        id: voice.voiceURI,
        name: voice.name,
        lang: voice.lang,
        source: 'web-speech' as const
      }));
      
      // 添加 OpenAI 語音選項
      const openaiVoices: VoiceOption[] = [
        { id: 'alloy', name: 'Alloy (OpenAI)', source: 'openai' },
        { id: 'echo', name: 'Echo (OpenAI)', source: 'openai' },
        { id: 'fable', name: 'Fable (OpenAI)', source: 'openai' },
        { id: 'onyx', name: 'Onyx (OpenAI)', source: 'openai' },
        { id: 'nova', name: 'Nova (OpenAI)', source: 'openai' },
        { id: 'shimmer', name: 'Shimmer (OpenAI)', source: 'openai' }
      ];
      
      // 合併所有語音選項
      const allVoices = [...browserVoices, ...openaiVoices];
      setAvailableVoices(allVoices);
      
      // 設置預設語音
      if (browserVoices.length > 0) {
        setHostVoice(browserVoices[0].id);
        setExpertVoice(browserVoices[Math.min(1, browserVoices.length - 1)]?.id || browserVoices[0].id);
      } else if (openaiVoices.length > 0) {
        setHostVoice(openaiVoices[0].id);
        setExpertVoice(openaiVoices[Math.min(1, openaiVoices.length - 1)]?.id || openaiVoices[0].id);
      }
    };
    
    // 獲取語音列表
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = initializeVoices;
    }
    
    initializeVoices();
  }, []);
  
  // 生成音訊
  const generateAudio = useCallback(async () => {
    if (!podcastState.script) {
      dispatch({ type: 'SET_ERROR', payload: '沒有可用的腳本' });
      return;
    }
    
    dispatch({ type: 'SET_AUDIO_STATE', payload: { isGenerating: true, progress: 0, error: null } });
    
    try {
      const ttsService = new TTSService();
      const audioService = new AudioService();
      
      // 生成所有對話的音訊
      const audioBlobs = await ttsService.generatePodcastAudio(
        podcastState.script.dialogues,
        hostVoice,
        expertVoice,
        (progress) => {
          dispatch({ type: 'SET_AUDIO_STATE', payload: { progress } });
        },
        apiKeys.openaiKey // 如果有 OpenAI 金鑰則使用 OpenAI TTS
      );
      
      // 合併所有音訊
      const mergedAudioBlob = await audioService.mergeAudioBlobs(audioBlobs);
      
      // 獲取音訊持續時間
      const duration = await audioService.getAudioDuration(mergedAudioBlob);
      
      // 創建音訊 URL
      const audioUrl = URL.createObjectURL(mergedAudioBlob);
      
      // 更新音訊狀態
      dispatch({ 
        type: 'SET_AUDIO_STATE', 
        payload: { 
          isGenerating: false, 
          progress: 100, 
          audioBlob: mergedAudioBlob, 
          audioUrl, 
          duration,
          error: null 
        } 
      });
    } catch (error) {
      console.error('生成音訊時發生錯誤:', error);
      dispatch({ 
        type: 'SET_AUDIO_STATE', 
        payload: { 
          isGenerating: false, 
          error: error instanceof Error ? error.message : '生成音訊時發生未知錯誤' 
        } 
      });
    }
  }, [apiKeys.openaiKey, dispatch, expertVoice, hostVoice, podcastState.script]);
  
  // 播放/暫停預覽
  const togglePreview = () => {
    if (!audioState.audioUrl) return;
    
    if (isPreviewPlaying) {
      // 暫停播放
      if (previewAudio) {
        previewAudio.pause();
      }
      setIsPreviewPlaying(false);
    } else {
      // 開始播放
      if (!previewAudio && audioState.audioUrl) {
        const audio = new Audio(audioState.audioUrl);
        audio.onended = () => {
          setIsPreviewPlaying(false);
          setPreviewAudio(null);
        };
        setPreviewAudio(audio);
        audio.play();
      } else if (previewAudio) {
        previewAudio.play();
      }
      setIsPreviewPlaying(true);
    }
  };
  
  // 下載播客
  const downloadPodcast = () => {
    if (!audioState.audioBlob || !podcastState.topic) return;
    
    const audioService = new AudioService();
    const date = new Date().toISOString().split('T')[0]; // 獲取當前日期
    const filename = `podcast_${podcastState.topic.replace(/\s+/g, '_')}_${date}.mp3`;
    
    audioService.createDownloadLink(audioState.audioBlob, filename);
  };
  
  // 返回腳本步驟
  const goToScriptStep = () => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'script' });
  };
  
  // 計算預估時長
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">音訊生成</h1>
        <p className="text-gray-400">
          為您的播客腳本生成音訊並下載
        </p>
      </div>
      
      {/* 錯誤訊息 */}
      {audioState.error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200">
          <div className="flex justify-between items-center">
            <span>{audioState.error}</span>
            <button 
              onClick={() => dispatch({ type: 'SET_AUDIO_STATE', payload: { error: null } })}
              className="text-red-200 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 設定面板 */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-6">音訊設定</h2>
            
            <div className="space-y-6">
              {/* 主持人聲音選擇 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  主持人聲音
                </label>
                <select
                  value={hostVoice}
                  onChange={(e) => setHostVoice(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={audioState.isGenerating}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} {voice.source === 'openai' && '(高品質)'}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 專家聲音選擇 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  專家聲音
                </label>
                <select
                  value={expertVoice}
                  onChange={(e) => setExpertVoice(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={audioState.isGenerating}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} {voice.source === 'openai' && '(高品質)'}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 語速調整 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  語速: {rate.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  disabled={audioState.isGenerating}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>慢</span>
                  <span>快</span>
                </div>
              </div>
              
              {/* 預估時長 */}
              {podcastState.script && (
                <div className="bg-indigo-500/10 rounded-lg p-4 border border-indigo-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-300">預估時長</span>
                    <span className="text-white font-medium">
                      {formatDuration(podcastState.script.totalDuration)}
                    </span>
                  </div>
                </div>
              )}
              
              {/* 生成按鈕 */}
              <button
                onClick={generateAudio}
                disabled={audioState.isGenerating || !podcastState.script}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  audioState.isGenerating || !podcastState.script
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {audioState.isGenerating ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    生成中... {audioState.progress}%
                  </span>
                ) : (
                  '生成音訊'
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* 預覽和下載面板 */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-6">音訊預覽</h2>
            
            {audioState.audioBlob ? (
              <div className="space-y-6">
                {/* 音訊播放器 */}
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-medium">播客音訊</h3>
                      <p className="text-gray-400 text-sm">
                        時長: {formatDuration(audioState.duration)}
                      </p>
                    </div>
                    
                    <button
                      onClick={togglePreview}
                      disabled={!audioState.audioUrl}
                      className={`p-3 rounded-full ${
                        isPreviewPlaying 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-green-500 hover:bg-green-600'
                      } text-white transition-colors`}
                    >
                      {isPreviewPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  {/* 音訊波形圖 (簡化版) */}
                  <div className="h-24 bg-gray-800 rounded-lg flex items-end justify-center space-x-1 p-2">
                    {Array.from({ length: 50 }).map((_, i) => (
                      <div 
                        key={i}
                        className="bg-indigo-500 rounded-t w-1"
                        style={{ height: `${Math.random() * 80 + 10}%` }}
                      ></div>
                    ))}
                  </div>
                </div>
                
                {/* 下載按鈕 */}
                <button
                  onClick={downloadPodcast}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  下載播客音訊
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <h3 className="text-lg font-medium text-white mb-2">尚未生成音訊</h3>
                <p className="text-gray-400">
                  點擊「生成音訊」按鈕為您的播客腳本創建音訊
                </p>
              </div>
            )}
            
            {/* 返回按鈕 */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <button
                onClick={goToScriptStep}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all"
              >
                ← 返回腳本
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPanel;