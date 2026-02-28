import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TTSService } from '../services/ttsService';
import { AudioService } from '../services/audioService';
import { VoiceOption } from '../types';

// Stable decorative waveform heights (computed once, never re-randomized)
const WAVEFORM_HEIGHTS = Array.from({ length: 50 }, (_, i) => {
  const x = Math.sin(i * 0.7 + 1.3) * 0.5 + 0.5;
  return Math.floor(x * 75 + 15);
});

const AudioPanel: React.FC = () => {
  const {
    apiKeys,
    podcastState,
    audioState,
    dispatch,
  } = useAppContext();

  const [hostVoice, setHostVoice] = useState<string>('');
  const [expertVoice, setExpertVoice] = useState<string>('');
  const [rate, setRate] = useState<number>(1.0);
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Build voice list
  useEffect(() => {
    const buildVoiceList = () => {
      const browserVoices: VoiceOption[] = speechSynthesis.getVoices().map(v => ({
        id: v.voiceURI,
        name: v.name,
        lang: v.lang,
        source: 'web-speech' as const,
      }));

      const openaiVoices: VoiceOption[] = [
        { id: 'alloy', name: 'Alloy (OpenAI)', source: 'openai' },
        { id: 'echo', name: 'Echo (OpenAI)', source: 'openai' },
        { id: 'fable', name: 'Fable (OpenAI)', source: 'openai' },
        { id: 'onyx', name: 'Onyx (OpenAI)', source: 'openai' },
        { id: 'nova', name: 'Nova (OpenAI)', source: 'openai' },
        { id: 'shimmer', name: 'Shimmer (OpenAI)', source: 'openai' },
      ];

      const all = [...browserVoices, ...openaiVoices];
      setAvailableVoices(all);

      // Set defaults on first load only
      setHostVoice(prev => {
        if (prev) return prev;
        return apiKeys.openaiKey ? 'onyx' : (browserVoices[0]?.id ?? 'onyx');
      });
      setExpertVoice(prev => {
        if (prev) return prev;
        return apiKeys.openaiKey ? 'nova' : (browserVoices[1]?.id ?? browserVoices[0]?.id ?? 'nova');
      });
    };

    speechSynthesis.onvoiceschanged = buildVoiceList;
    buildVoiceList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop preview on unmount
  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
    };
  }, []);

  // Generate audio
  const generateAudio = useCallback(async () => {
    if (!podcastState.script) {
      dispatch({ type: 'SET_ERROR', payload: 'No script available. Please generate a script first.' });
      return;
    }

    dispatch({ type: 'SET_AUDIO_STATE', payload: { isGenerating: true, progress: 0, error: null } });

    try {
      const ttsService = new TTSService();
      const audioService = new AudioService();

      // Resolve OpenAI voice IDs from selected values
      const hostVoiceOpenai = (availableVoices.find(v => v.id === hostVoice)?.source === 'openai'
        ? hostVoice
        : 'onyx') as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
      const expertVoiceOpenai = (availableVoices.find(v => v.id === expertVoice)?.source === 'openai'
        ? expertVoice
        : 'nova') as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

      const audioBlobs = await ttsService.generatePodcastAudio(
        podcastState.script.dialogues,
        hostVoice,
        expertVoice,
        (progress) => {
          dispatch({ type: 'SET_AUDIO_STATE', payload: { progress } });
        },
        apiKeys.openaiKey,
        rate,
        hostVoiceOpenai,
        expertVoiceOpenai
      );

      const mergedAudioBlob = await audioService.mergeAudioBlobs(audioBlobs);
      const duration = await audioService.getAudioDuration(mergedAudioBlob);
      const audioUrl = URL.createObjectURL(mergedAudioBlob);

      dispatch({
        type: 'SET_AUDIO_STATE',
        payload: {
          isGenerating: false,
          progress: 100,
          audioBlob: mergedAudioBlob,
          audioUrl,
          duration,
          error: null,
        },
      });
    } catch (error) {
      console.error('Audio generation error:', error);
      dispatch({
        type: 'SET_AUDIO_STATE',
        payload: {
          isGenerating: false,
          error: error instanceof Error ? error.message : 'Audio generation failed.',
        },
      });
    }
  }, [apiKeys.openaiKey, availableVoices, dispatch, expertVoice, hostVoice, podcastState.script, rate]);

  // Toggle play/pause preview
  const togglePreview = () => {
    if (!audioState.audioUrl) return;

    if (isPreviewPlaying) {
      previewAudioRef.current?.pause();
      setIsPreviewPlaying(false);
    } else {
      if (!previewAudioRef.current) {
        const audio = new Audio(audioState.audioUrl);
        audio.onended = () => {
          setIsPreviewPlaying(false);
          previewAudioRef.current = null;
        };
        previewAudioRef.current = audio;
      }
      previewAudioRef.current.play();
      setIsPreviewPlaying(true);
    }
  };

  // Download podcast with correct file extension
  const downloadPodcast = () => {
    if (!audioState.audioBlob || !podcastState.topic) return;
    const audioService = new AudioService();
    const date = new Date().toISOString().split('T')[0];
    const slug = podcastState.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const ext = apiKeys.openaiKey ? 'mp3' : 'wav';
    audioService.createDownloadLink(audioState.audioBlob, `podcast_${slug}_${date}.${ext}`);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Audio Generation</h1>
        <p className="text-gray-400">
          Configure voices and generate audio for your podcast script.
        </p>
      </div>

      {/* Error banner */}
      {audioState.error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200">
          <div className="flex justify-between items-center gap-3">
            <span>{audioState.error}</span>
            <button
              onClick={() => dispatch({ type: 'SET_AUDIO_STATE', payload: { error: null } })}
              className="text-red-200 hover:text-white transition-colors flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings panel */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-6">Audio Settings</h2>

            <div className="space-y-6">
              {/* Host voice */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Host Voice</label>
                <select
                  value={hostVoice}
                  onChange={(e) => setHostVoice(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={audioState.isGenerating}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}{voice.source === 'openai' ? ' (HD)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expert voice */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Expert Voice</label>
                <select
                  value={expertVoice}
                  onChange={(e) => setExpertVoice(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={audioState.isGenerating}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}{voice.source === 'openai' ? ' (HD)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Speed: {rate.toFixed(1)}×
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
                  <span>Slow</span>
                  <span>Fast</span>
                </div>
              </div>

              {/* Est. duration */}
              {podcastState.script && (
                <div className="bg-indigo-500/10 rounded-lg p-4 border border-indigo-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-300 text-sm">Est. Duration</span>
                    <span className="text-white font-medium">
                      {formatDuration(podcastState.script.totalDuration)}
                    </span>
                  </div>
                </div>
              )}

              {/* Warning if no OpenAI key */}
              {!apiKeys.openaiKey && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-300 text-xs leading-relaxed">
                    <strong>No OpenAI key:</strong> Audio will use your browser's built-in voices for playback only. Download requires an OpenAI key.
                  </p>
                </div>
              )}

              {/* Generate button */}
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
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating… {audioState.progress}%
                  </span>
                ) : (
                  'Generate Audio'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Preview & download */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-6">Audio Preview</h2>

            {audioState.audioBlob ? (
              <div className="space-y-6">
                {/* Player */}
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-medium">Podcast Audio</h3>
                      <p className="text-gray-400 text-sm">
                        Duration: {formatDuration(audioState.duration)}
                      </p>
                    </div>

                    <button
                      onClick={togglePreview}
                      disabled={!audioState.audioUrl}
                      aria-label={isPreviewPlaying ? 'Pause' : 'Play'}
                      className={`p-3 rounded-full ${
                        isPreviewPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
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

                  {/* Decorative waveform (static — no random re-renders) */}
                  <div className="h-24 bg-gray-800 rounded-lg flex items-end justify-center space-x-1 p-2">
                    {WAVEFORM_HEIGHTS.map((h, i) => (
                      <div
                        key={i}
                        className={`rounded-t w-1 transition-colors duration-300 ${
                          isPreviewPlaying ? 'bg-green-400' : 'bg-indigo-500'
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Download (only available with OpenAI) */}
                {apiKeys.openaiKey ? (
                  <button
                    onClick={downloadPodcast}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Download Podcast (.mp3)
                  </button>
                ) : (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
                    <p className="text-yellow-300 text-sm">
                      Download requires an OpenAI API key — add one in Settings.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <h3 className="text-lg font-medium text-white mb-2">No Audio Yet</h3>
                <p className="text-gray-400 text-sm">
                  Click "Generate Audio" to synthesize your podcast script into audio.
                </p>
              </div>
            )}

            {/* Back button */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <button
                onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 'script' })}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all"
              >
                ← Back to Script
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPanel;
